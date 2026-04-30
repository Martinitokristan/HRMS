<?php

namespace App\Services\Sales;

use App\Events\DataMutated;
use App\Models\Sale;
use App\Models\SalesCancellation;
use App\Models\SalesCancellationRequest;
use App\Models\CustomerNotification;
use App\Traits\RestoresStock;
use Illuminate\Support\Facades\DB;

class SaleCancellationService
{
    use RestoresStock;

    /**
     * Get pending cancellation requests.
     */
    public function getPendingRequests($request)
    {
        $status = $request->get('status', 'pending');
        if (!in_array($status, ['pending', 'approved', 'rejected', 'all'], true)) {
            $status = 'pending';
        }

        $query = Sale::with(['customer', 'items.product', 'delivery', 'cancellationRequest', 'cancellation'])
            ->whereNotNull('cancellation_status')
            ->when($status !== 'all', fn ($q) => $q->where('cancellation_status', $status))
            ->when($request->search, function ($q) use ($request) {
                $search = $request->search;
                return $q->where(function ($sq) use ($search) {
                    $sq->where('order_number', 'like', "%{$search}%")
                        ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$search}%"));
                });
            })
            ->latest('cancellation_requested_at');

        $paginated = $query->paginate($request->get('per_page', 20));

        $paginated->getCollection()->transform(function ($sale) {
            $sale->cancellation_request = $sale->cancellationRequest;
            return $sale;
        });

        return $paginated;
    }

    /**
     * Request cancellation (customer - requires admin approval).
     */
    public function requestCancellation($sale, $user, $reason, $notes)
    {
        // Check if already requested
        if ($sale->cancellation_status === 'pending' || ($sale->cancellationRequest && $sale->cancellationRequest->status === 'pending')) {
            return [
                'error' => 'Cancellation request is already pending approval.',
                'status_code' => 422,
            ];
        }

        DB::transaction(function () use ($sale, $user, $reason, $notes) {
            $sale->update([
                'cancellation_status' => 'pending',
                'cancellation_requested_by' => $user->id,
                'cancellation_requested_at' => now(),
            ]);

            SalesCancellationRequest::updateOrCreate(
                ['sale_id' => $sale->id],
                [
                    'reason' => $reason,
                    'notes' => $notes,
                    'requested_by' => $user->id,
                    'requested_at' => now(),
                    'status' => 'pending',
                    'admin_notes' => null,
                    'resolved_by' => null,
                    'resolved_at' => null,
                ]
            );

            CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type' => 'cancellation_requested',
                'title' => 'Cancellation Requested',
                'message' => "Your cancellation request for order #{$sale->order_number} has been submitted and is pending admin review.",
                'is_read' => false,
            ]);

            $customerId = $sale->customer_id;
            broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'sale.cancellation_requested'));
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'sale.cancellation_requested'));
        });

        return [
            'sale' => $sale->fresh()->load(['items.product', 'delivery', 'cancellationRequest']),
            'status_code' => 200,
        ];
    }

    /**
     * Approve cancellation request.
     */
    public function approve($sale, $user)
    {
        if ($sale->cancellation_status !== 'pending' || !$sale->cancellationRequest || $sale->cancellationRequest->status !== 'pending') {
            return [
                'error' => 'No pending cancellation found for this order.',
                'status_code' => 422,
            ];
        }

        DB::transaction(function () use ($sale, $user) {
            $this->restoreStock($sale);

            $refundStatus = 'not_applicable';
            if ($sale->payment_method === 'gcash' && $sale->payment_confirmed_at !== null) {
                $refundStatus = 'pending_refund';
            }

            $sale->update([
                'status' => 'cancelled',
                'cancellation_status' => 'approved',
                'refund_status' => $refundStatus,
            ]);

            SalesCancellation::updateOrCreate(
                ['sale_id' => $sale->id],
                [
                    'reason' => $sale->cancellationRequest->reason,
                    'notes' => $sale->cancellationRequest->notes,
                    'cancelled_by' => $user->id,
                    'cancelled_at' => now(),
                ]
            );

            $sale->cancellationRequest->update([
                'status' => 'approved',
                'resolved_by' => $user->id,
                'resolved_at' => now(),
            ]);

            if ($sale->delivery) {
                $sale->delivery->update(['status' => 'failed']);
            }

            $customerMsg = $refundStatus === 'pending_refund'
                ? "Your cancellation request for order #{$sale->order_number} has been approved. Your GCash payment will be refunded shortly."
                : "Your cancellation request for order #{$sale->order_number} has been approved.";

            CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type' => 'cancellation_approved',
                'title' => 'Cancellation Approved',
                'message' => $customerMsg,
                'is_read' => false,
            ]);
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_inventory', 'admin_dashboard'], 'sale.cancellation_approved'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications', 'customer_shop'], 'sale.cancellation_approved'));

        return [
            'sale' => $sale->fresh()->load(['customer', 'items.product', 'delivery']),
            'status_code' => 200,
        ];
    }

    /**
     * Reject cancellation request.
     */
    public function reject($sale, $user, $adminNotes = null)
    {
        if ($sale->cancellation_status !== 'pending' || !$sale->cancellationRequest || $sale->cancellationRequest->status !== 'pending') {
            return [
                'error' => 'Only pending cancellation requests can be rejected.',
                'status_code' => 422,
            ];
        }

        DB::transaction(function () use ($sale, $user, $adminNotes) {
            $sale->update(['cancellation_status' => 'rejected']);

            $sale->cancellationRequest->update([
                'status' => 'rejected',
                'admin_notes' => $adminNotes,
                'resolved_by' => $user ? $user->id : null,
                'resolved_at' => now(),
            ]);

            $message = "Your cancellation request for order #{$sale->order_number} has been rejected.";
            if (!empty($adminNotes)) {
                $message .= " Admin note: {$adminNotes}";
            }

            CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type' => 'cancellation_rejected',
                'title' => 'Cancellation Rejected',
                'message' => $message,
                'is_read' => false,
            ]);
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'sale.cancellation_rejected'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'sale.cancellation_rejected'));

        return [
            'sale' => $sale->fresh()->load(['customer', 'items.product', 'delivery']),
            'status_code' => 200,
        ];
    }
}
