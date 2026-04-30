<?php

namespace App\Services\Deliveries;

use App\Events\DataMutated;
use App\Models\Delivery;
use App\Models\CustomerNotification;

class DeliveryLocationService
{
    /**
     * Rider sends their location; if within 1km of destination, notify the customer.
     */
    public function riderProximityUpdate($delivery, $latitude, $longitude)
    {
        if (!$delivery->latitude || !$delivery->longitude) {
            return [
                'distance_km' => null,
                'notified' => false,
                'status' => 'skip',
            ];
        }

        $distance = $this->haversineKm($latitude, $longitude, $delivery->latitude, $delivery->longitude);
        $notified = false;

        if ($distance <= 1.0 && $delivery->sale && $delivery->sale->customer_id) {
            // Check if we already sent a proximity notification for this delivery in the last 10 minutes
            $recentNotification = CustomerNotification::where('delivery_id', $delivery->id)
                ->where('type', 'proximity')
                ->where('created_at', '>=', now()->subMinutes(10))
                ->exists();

            if (!$recentNotification) {
                $riderName = $delivery->rider ? $delivery->rider->name : 'Your rider';
                $distanceStr = round($distance * 1000) . 'm';

                CustomerNotification::create([
                    'customer_id' => $delivery->sale->customer_id,
                    'delivery_id' => $delivery->id,
                    'type' => 'proximity',
                    'title' => 'Rider is nearby!',
                    'message' => "{$riderName} is approximately {$distanceStr} away from your location. Please prepare to receive your order.",
                    'meta' => [
                        'distance_km' => round($distance, 3),
                        'rider_name' => $riderName,
                        'order_number' => $delivery->sale->order_number ?? null,
                    ],
                ]);
                $notified = true;
            }
        }

        return [
            'distance_km' => round($distance, 3),
            'notified' => $notified,
            'status' => 'success',
        ];
    }

    /**
     * Update rider location during in-progress delivery.
     */
    public function updateLocation($delivery, $user, $latitude, $longitude)
    {
        $delivery = Delivery::where('id', $delivery->id)
            ->where('rider_id', $user->id)
            ->where('status', 'in_progress')
            ->firstOrFail();

        $delivery->update([
            'rider_latitude' => $latitude,
            'rider_longitude' => $longitude,
        ]);

        // Broadcast location update to customer
        if ($delivery->sale && $delivery->sale->customer_id) {
            broadcast(new \App\Events\RiderLocationUpdated(
                $delivery->sale->customer_id,
                $delivery->rider_id,
                $latitude,
                $longitude,
                0,
                $delivery->tracking_number
            ));
        }

        return ['status_code' => 200];
    }

    /**
     * Get current rider location for a delivery (customer view).
     */
    public function getRiderLocation($delivery, $user)
    {
        // Verify this delivery belongs to the authenticated customer
        if ($delivery->sale->customer_id !== $user->id) {
            return [
                'error' => 'Unauthorized',
                'status_code' => 403,
            ];
        }

        if (!$delivery->rider_id) {
            return [
                'data' => null,
                'status_code' => 200,
            ];
        }

        $riderProfile = \App\Models\RiderProfile::where('user_id', $delivery->rider_id)->first();

        if (!$riderProfile || !$riderProfile->current_latitude || !$riderProfile->current_longitude) {
            return [
                'data' => null,
                'status_code' => 200,
            ];
        }

        return [
            'data' => [
                'latitude' => $riderProfile->current_latitude,
                'longitude' => $riderProfile->current_longitude,
                'heading' => $riderProfile->current_heading,
                'updated_at' => $riderProfile->updated_at
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Calculate distance in km using Haversine formula.
     */
    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $lat1 = deg2rad($lat1);
        $lng1 = deg2rad($lng1);
        $lat2 = deg2rad($lat2);
        $lng2 = deg2rad($lng2);

        $dlat = $lat2 - $lat1;
        $dlng = $lng2 - $lng1;
        $a = sin($dlat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dlng / 2) ** 2;
        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
