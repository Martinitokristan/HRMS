<?php

namespace App\Services\Deliveries;

use App\Models\Delivery;
use App\Models\CustomerNotification;
use App\Models\Setting;

class DeliveryReceiptService
{
    /**
     * Customer confirms they received the order.
     */
    public function customerConfirmReceipt($sale, $user)
    {
        if ((int) $sale->customer_id !== (int) $user->id) {
            return [
                'error' => 'Forbidden',
                'status_code' => 403,
            ];
        }

        if (!$sale->delivery) {
            return [
                'error' => 'No delivery to confirm',
                'status_code' => 422,
            ];
        }

        if ($sale->delivery->customer_disputed_at) {
            return [
                'error' => 'Delivery is already disputed',
                'status_code' => 422,
            ];
        }

        if (!$sale->delivery->customer_confirmed_at) {
            $sale->delivery->update(['customer_confirmed_at' => now()]);
        }

        app(DeliveryPayoutEligibilityService::class)->maybePromoteToEligible($sale->delivery->fresh());

        CustomerNotification::where('delivery_id', $sale->delivery->id)
            ->where('type', 'delivery_confirmation_request')
            ->get()
            ->each(function ($n) {
                $meta = $n->meta ?: [];
                $meta['requires_action'] = false;
                $meta['action_taken'] = 'confirmed';
                $meta['actioned_at'] = now()->toIso8601String();
                $n->update(['meta' => $meta, 'is_read' => true]);
            });

        return ['status_code' => 200];
    }

    /**
     * Customer disputes the delivery.
     */
    public function customerDisputeReceipt($sale, $user, $reason)
    {
        if ((int) $sale->customer_id !== (int) $user->id) {
            return [
                'error' => 'Forbidden',
                'status_code' => 403,
            ];
        }

        if (!$sale->delivery) {
            return [
                'error' => 'No delivery to dispute',
                'status_code' => 422,
            ];
        }

        $sale->delivery->update([
            'customer_disputed_at' => now(),
            'customer_dispute_reason' => $reason,
            'payout_status' => 'held',
        ]);

        CustomerNotification::where('delivery_id', $sale->delivery->id)
            ->where('type', 'delivery_confirmation_request')
            ->get()
            ->each(function ($n) {
                $meta = $n->meta ?: [];
                $meta['requires_action'] = false;
                $meta['action_taken'] = 'disputed';
                $meta['actioned_at'] = now()->toIso8601String();
                $n->update(['meta' => $meta, 'is_read' => true]);
            });

        return ['status_code' => 200];
    }

    /**
     * Post the "Did you receive your order?" customer notification on first delivered transition.
     */
    public function postConfirmationNotification(Delivery $delivery)
    {
        if (!$delivery->sale || !$delivery->sale->customer_id) {
            return;
        }

        if ($delivery->customer_confirmed_at || $delivery->customer_disputed_at) {
            return;
        }

        // Avoid spamming if proof is uploaded multiple times — one row per delivery.
        $exists = CustomerNotification::where('delivery_id', $delivery->id)
            ->where('type', 'delivery_confirmation_request')
            ->exists();
        if ($exists) {
            return;
        }

        $windowHours = (int) Setting::get('rider_customer_confirm_window_hours', 24);

        CustomerNotification::create([
            'customer_id' => $delivery->sale->customer_id,
            'delivery_id' => $delivery->id,
            'type' => 'delivery_confirmation_request',
            'title' => 'Did you receive your order?',
            'message' => 'Tap "Yes, I received it" to confirm. If something is wrong, tap "No, something is wrong". We will auto-confirm in ' . $windowHours . ' hours if there is no response.',
            'meta' => [
                'requires_action' => true,
                'delivery_id' => $delivery->id,
                'sale_id' => $delivery->sale_id,
                'auto_confirm_at' => now()->addHours($windowHours)->toIso8601String(),
            ],
            'is_read' => false,
        ]);
    }
}
