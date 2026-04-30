<?php

namespace App\Services\Deliveries;

use App\Models\Delivery;
use App\Models\Setting;

class GeofenceService
{
    /**
     * Stamp rider GPS, distance to customer, and geofence flag on first delivered transition.
     * Write-once operation.
     */
    public function stamp(Delivery $delivery, $riderLat, $riderLng)
    {
        if (!is_null($delivery->mark_delivered_lat) || !is_null($delivery->mark_delivered_lng)) {
            return; // already stamped — write-once
        }
        if (is_null($riderLat) || is_null($riderLng)) {
            return; // rider didn't share GPS; admin can review the missing GPS in Payouts
        }

        $threshold = (int) Setting::get('rider_geofence_flag_radius_m', 50);

        // Customer coords from the customer profile (preferred) or from the delivery row.
        $customerLat = optional(optional(optional($delivery->sale)->customer)->customerProfile)->latitude
            ?? $delivery->latitude;
        $customerLng = optional(optional(optional($delivery->sale)->customer)->customerProfile)->longitude
            ?? $delivery->longitude;

        $update = [
            'mark_delivered_lat' => (float) $riderLat,
            'mark_delivered_lng' => (float) $riderLng,
        ];

        if (!is_null($customerLat) && !is_null($customerLng)) {
            $distanceM = $this->haversineMeters($riderLat, $riderLng, $customerLat, $customerLng);
            $update['geofence_distance_m'] = (int) round($distanceM);
            $update['geofence_flagged'] = $distanceM > $threshold;
        }

        $delivery->update($update);
    }

    /**
     * Calculate distance in meters using Haversine formula.
     */
    private function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R = 6371000;
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $dPhi = deg2rad($lat2 - $lat1);
        $dLambda = deg2rad($lng2 - $lng1);
        $a = sin($dPhi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($dLambda / 2) ** 2;
        return 2 * $R * atan2(sqrt($a), sqrt(1 - $a));
    }
}
