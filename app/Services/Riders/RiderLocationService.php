<?php

namespace App\Services\Riders;

use App\Models\RiderProfile;
use App\Models\Delivery;
use App\Events\RiderLocationUpdated;

class RiderLocationService
{
    /**
     * Update rider's current location.
     */
    public function updateLocation($riderId, $latitude, $longitude, $shouldBroadcast = false)
    {
        $profile = RiderProfile::where('user_id', $riderId)->first();

        if ($profile) {
            $profile->current_latitude = $latitude;
            $profile->current_longitude = $longitude;
            $profile->save();
        }

        if ($shouldBroadcast) {
            $this->broadcastLocationToCustomers($riderId, $latitude, $longitude);
        }

        return [
            'status_code' => 200,
        ];
    }

    /**
     * Broadcast location to all customers with active deliveries.
     */
    private function broadcastLocationToCustomers($riderId, $latitude, $longitude)
    {
        $activeDeliveries = Delivery::where('rider_id', $riderId)
            ->whereIn('status', ['pending', 'in_progress'])
            ->with('sale.customer')
            ->get();

        foreach ($activeDeliveries as $delivery) {
            if ($delivery->sale && $delivery->sale->customer_id) {
                broadcast(new RiderLocationUpdated(
                    $delivery->sale->customer_id,
                    $riderId,
                    $latitude,
                    $longitude,
                    $delivery->tracking_number ?? 0
                ));
            }
        }
    }
}
