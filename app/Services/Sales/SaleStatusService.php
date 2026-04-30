<?php

namespace App\Services\Sales;

use App\Events\DataMutated;
use App\Models\Sale;
use App\Models\SalesCancellation;
use App\Models\CustomerNotification;
use App\Traits\RestoresStock;
use Illuminate\Support\Facades\DB;

class SaleStatusService
{
    use RestoresStock;

    /**
     * Update sale status and sync delivery status.
     */
    public function updateStatus($sale, $newStatus)
    {
        $oldStatus = $sale->status;

        // Prevent changing status of already cancelled/returned orders
        if (in_array($oldStatus, ['cancelled', 'returned'])) {
            return [
                'error' => 'Cannot change status of a cancelled or returned order.',
                'status_code' => 422,
            ];
        }

        DB::transaction(function () use ($sale, $newStatus) {
            $sale->update(['status' => $newStatus]);

            if ($newStatus === 'confirmed') {
                $sale->refresh();
                $sale->markConfirmedOnce();
            }

            if ($newStatus === 'cancelled') {
                $this->restoreStock($sale);
            }
        });

        if ($newStatus === 'confirmed' || $newStatus === 'cancelled') {
            \App\Support\ProductCache::bust();
        }

        // Sync delivery status with sale status
        if ($sale->delivery) {
            if ($newStatus === 'confirmed') {
                $sale->delivery->update(['status' => 'pending']);
            } elseif ($newStatus === 'out_for_delivery') {
                $sale->delivery->update(['status' => 'in_progress', 'pickup_at' => now()]);
            } elseif ($newStatus === 'delivered') {
                $sale->delivery->update(['status' => 'delivered', 'delivered_at' => now()]);
            } elseif ($newStatus === 'cancelled') {
                $sale->delivery->update(['status' => 'failed']);
            }
        }

        // Notify customer on meaningful status change
        if ($sale->customer_id) {
            $notifications = [
                'confirmed' => ['Order Confirmed', "Your order #{$sale->order_number} has been confirmed and is being prepared."],
                'out_for_delivery' => ['Out for Delivery', "Your order #{$sale->order_number} is now out for delivery. Expect it soon!"],
                'delivered' => ['Order Delivered', "Your order #{$sale->order_number} has been delivered. Thank you for your purchase!"],
                'cancelled' => ['Order Cancelled', "Your order #{$sale->order_number} has been cancelled."],
            ];
            if (isset($notifications[$newStatus])) {
                [$title, $message] = $notifications[$newStatus];
                CustomerNotification::create([
                    'customer_id' => $sale->customer_id,
                    'delivery_id' => $sale->delivery->id ?? null,
                    'type' => $newStatus,
                    'title' => $title,
                    'message' => $message,
                    'is_read' => false,
                ]);
            }
        }

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard', 'admin_deliveries'], 'sale.status_updated'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'sale.status_updated'));

        return [
            'sale' => $sale->fresh()->load(['customer', 'items.product', 'delivery']),
            'status_code' => 200,
        ];
    }

    /**
     * Process return and restore stock.
     */
    public function processReturn($sale)
    {
        DB::transaction(function () use ($sale) {
            $sale->update(['status' => 'returned']);
            $this->restoreStock($sale);
        });

        \App\Support\ProductCache::bust();

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_inventory', 'admin_dashboard'], 'sale.returned'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders'], 'sale.returned'));

        return [
            'sale' => $sale->fresh(),
            'status_code' => 200,
        ];
    }

    /**
     * Cancel pending payment GCash order.
     */
    public function cancelPendingPayment($sale, $user)
    {
        if ($sale->customer_id !== $user->id) {
            return [
                'error' => 'Unauthorized',
                'status_code' => 403,
            ];
        }

        if ($sale->status !== 'pending_payment') {
            return [
                'error' => 'This order is no longer in pending_payment and cannot be cancelled this way.',
                'status_code' => 422,
            ];
        }

        DB::transaction(function () use ($sale, $user) {
            $this->restoreStock($sale);

            $sale->update(['status' => 'cancelled']);

            SalesCancellation::create([
                'sale_id' => $sale->id,
                'reason' => 'changed_mind',
                'notes' => 'Cancelled by customer at GCash payment step.',
                'cancelled_by' => $user->id,
                'cancelled_at' => now(),
            ]);

            if ($sale->delivery) {
                $sale->delivery->update(['status' => 'failed']);
            }
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_inventory', 'admin_dashboard'], 'sale.cancelled'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_shop'], 'sale.cancelled'));

        return [
            'sale' => $sale->fresh()->load(['items.product', 'delivery']),
            'status_code' => 200,
        ];
    }
}
