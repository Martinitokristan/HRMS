<?php

namespace App\Services\Deliveries;

use App\Events\DataMutated;
use App\Models\Delivery;
use App\Models\RiderProfile;
use App\Models\CustomerNotification;

class DeliveryStatusService
{
    /**
     * Update delivery status. Called by rider.
     */
    public function updateStatus($delivery, $user, $newStatus, $riderLat = null, $riderLng = null)
    {
        // Verify this delivery belongs to the authenticated rider
        if ($delivery->rider_id !== $user->id) {
            return [
                'error' => 'Unauthorized - You can only update your own deliveries',
                'status_code' => 403,
            ];
        }

        $updates = ['status' => $newStatus];

        if ($newStatus === 'in_progress') {
            $updates['pickup_at'] = now();
            // Update sale status to out_for_delivery
            if ($delivery->sale) {
                $delivery->sale->update(['status' => 'out_for_delivery']);
            }
            // Mark rider as on_delivery when they accept
            if ($delivery->rider_id) {
                RiderProfile::where('user_id', $delivery->rider_id)
                    ->update(['availability' => 'on_delivery']);
            }
        }

        if ($newStatus === 'delivered') {
            $updates['delivered_at'] = now();
            // Update sale status
            if ($delivery->sale) {
                $delivery->sale->update(['status' => 'delivered']);
            }
            \App\Support\ProductCache::bust();
            // Free up the rider
            if ($delivery->rider_id) {
                RiderProfile::where('user_id', $delivery->rider_id)
                    ->update(['availability' => 'available']);
            }
            // Notify customer that delivery is complete
            if ($delivery->sale && $delivery->sale->customer_id) {
                CustomerNotification::create([
                    'customer_id' => $delivery->sale->customer_id,
                    'delivery_id' => $delivery->id,
                    'type' => 'delivered',
                    'title' => 'Order Delivered',
                    'message' => 'Your order has been delivered! Please rate your experience.',
                    'is_read' => false,
                ]);
            }
        }

        if ($newStatus === 'failed') {
            // Free up the rider
            if ($delivery->rider_id) {
                RiderProfile::where('user_id', $delivery->rider_id)
                    ->update(['availability' => 'available']);
            }
        }

        $delivery->update($updates);

        // Wave 6 — geofence stamp + customer-confirm notification + payout-eligibility check.
        if ($newStatus === 'delivered') {
            app(GeofenceService::class)->stamp($delivery->fresh(), $riderLat, $riderLng);
            app(DeliveryReceiptService::class)->postConfirmationNotification($delivery->fresh());
            app(DeliveryPayoutEligibilityService::class)->maybePromoteToEligible($delivery->fresh());
        }

        // Broadcasts
        $riderId = $user->id;
        $customerId = $delivery->sale ? $delivery->sale->customer_id : null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard', 'admin_orders'], 'delivery.status_updated'));
        broadcast(new DataMutated("private-rider.{$riderId}", ['rider_dashboard'], 'delivery.status_updated'));
        if ($customerId) {
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.status_updated'));
        }

        return [
            'delivery' => $delivery->fresh()->load(['sale', 'rider']),
            'status_code' => 200,
        ];
    }
}
