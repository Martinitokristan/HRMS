<?php

namespace App\Services\Sales;

use App\Events\DataMutated;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\CustomerNotification;
use Illuminate\Support\Facades\DB;

class SaleRefundService
{
    /**
     * Mark a sale as refunded.
     */
    public function markRefunded($sale, $user)
    {
        if ($sale->refund_status !== 'pending_refund') {
            return [
                'error' => 'This order is not awaiting a refund.',
                'status_code' => 422,
            ];
        }

        DB::transaction(function () use ($sale, $user) {
            $sale->update([
                'refund_status' => 'refunded',
                'refunded_at' => now(),
                'refunded_by' => $user ? $user->id : null,
            ]);

            CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type' => 'refund_completed',
                'title' => 'Refund Completed',
                'message' => "Your GCash refund for order #{$sale->order_number} has been sent.",
                'is_read' => false,
            ]);
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'sale.refunded'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'sale.refunded'));

        return [
            'sale' => $sale->fresh(),
            'status_code' => 200,
        ];
    }
}
