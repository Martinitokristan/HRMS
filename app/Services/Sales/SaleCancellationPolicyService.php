<?php

namespace App\Services\Sales;

use App\Models\Sale;
use App\Traits\RestoresStock;
use Illuminate\Support\Facades\DB;

class SaleCancellationPolicyService
{
    use RestoresStock;

    /**
     * Get cancellation policy for an order.
     */
    public function getPolicy($sale, $user)
    {
        if ($user instanceof \App\Models\User && $user->role === 'customer') {
            if ($sale->customer_id !== $user->id) {
                return [
                    'error' => 'Forbidden. You can only view your own orders.',
                    'status_code' => 403,
                ];
            }
        }

        $alreadyRequested = $sale->cancellation_status === 'pending';
        $cancellable = in_array($sale->status, ['pending', 'confirmed']) && !$alreadyRequested;
        $customerCanCancel = $sale->status === 'pending';
        $needsAdminApproval = $sale->status === 'confirmed';

        return [
            'policy' => [
                'cancellable' => $cancellable,
                'already_requested' => $alreadyRequested,
                'customer_can_cancel' => $customerCanCancel,
                'needs_admin_approval' => $needsAdminApproval,
                'current_status' => $sale->status,
                'reasons' => [
                    ['value' => 'changed_mind', 'label' => 'Changed my mind'],
                    ['value' => 'wrong_item', 'label' => 'Ordered wrong item'],
                    ['value' => 'duplicate_order', 'label' => 'Duplicate order'],
                    ['value' => 'price_issue', 'label' => 'Price issue'],
                    ['value' => 'found_better', 'label' => 'Found better alternative'],
                    ['value' => 'too_long', 'label' => 'Taking too long'],
                    ['value' => 'other', 'label' => 'Other'],
                ],
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Direct cancellation by admin or customer (policy-dependent).
     */
    public function directCancel($sale, $user, $reason, $notes)
    {
        $isAdmin = in_array($user->role, ['admin', 'manager']);
        $isOwner = $sale->customer_id === $user->id;

        // Authorization: must be owner or admin
        if (!$isOwner && !$isAdmin) {
            return [
                'error' => 'Unauthorized',
                'status_code' => 403,
            ];
        }

        if (in_array($sale->status, ['cancelled', 'returned', 'delivered'])) {
            return [
                'error' => 'This order can no longer be cancelled.',
                'status_code' => 422,
            ];
        }

        $isCustomer = !$isAdmin;

        // Customer can only cancel pending; confirmed requires request
        if ($isCustomer && $sale->status === 'confirmed') {
            return [
                'error' => 'Please submit a cancellation request for confirmed orders.',
                'status_code' => 422,
            ];
        }

        if (!in_array($sale->status, ['pending', 'confirmed'])) {
            return [
                'error' => 'Only pending or confirmed orders can be cancelled.',
                'status_code' => 422,
            ];
        }

        DB::transaction(function () use ($sale, $user, $reason, $notes) {
            $this->restoreStock($sale);

            $sale->update(['status' => 'cancelled']);

            \App\Models\SalesCancellation::create([
                'sale_id' => $sale->id,
                'reason' => $reason,
                'notes' => $notes,
                'cancelled_by' => $user->id,
                'cancelled_at' => now(),
            ]);

            // Cancel associated delivery
            if ($sale->delivery) {
                $sale->delivery->update(['status' => 'failed']);
            }

            // Notify customer
            \App\Models\CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type' => 'cancelled',
                'title' => 'Order Cancelled',
                'message' => "Your order #{$sale->order_number} has been cancelled. Reason: " . str_replace('_', ' ', ucfirst($reason)),
                'is_read' => false,
            ]);
        });

        $customerId = $sale->customer_id;
        broadcast(new \App\Events\DataMutated('private-admin', ['admin_orders', 'admin_inventory', 'admin_dashboard'], 'sale.cancelled'));
        broadcast(new \App\Events\DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications', 'customer_shop'], 'sale.cancelled'));

        return [
            'sale' => $sale->fresh()->load(['items.product', 'delivery']),
            'status_code' => 200,
        ];
    }
}
