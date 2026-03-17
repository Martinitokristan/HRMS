<?php

namespace App\Services;

class DistanceCalculator
{
    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     *
     * @param float $lat1 Latitude of point 1
     * @param float $lon1 Longitude of point 1
     * @param float $lat2 Latitude of point 2
     * @param float $lon2 Longitude of point 2
     * @param string $unit Unit of measurement ('km', 'miles', 'm')
     * @return float Distance in specified unit
     */
    public function calculateDistance($lat1, $lon1, $lat2, $lon2, $unit = 'km')
    {
        // Convert degrees to radians
        $lat1Rad = deg2rad($lat1);
        $lon1Rad = deg2rad($lon1);
        $lat2Rad = deg2rad($lat2);
        $lon2Rad = deg2rad($lon2);

        // Haversine formula
        $deltaLat = $lat2Rad - $lat1Rad;
        $deltaLon = $lon2Rad - $lon1Rad;

        $a = sin($deltaLat / 2) * sin($deltaLat / 2) +
             cos($lat1Rad) * cos($lat2Rad) *
             sin($deltaLon / 2) * sin($deltaLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        // Earth's radius in kilometers
        $earthRadiusKm = 6371;

        $distanceKm = $earthRadiusKm * $c;

        // Convert to requested unit
        switch ($unit) {
            case 'miles':
                return $distanceKm * 0.621371;
            case 'm':
                return $distanceKm * 1000;
            case 'km':
            default:
                return $distanceKm;
        }
    }

    /**
     * Calculate estimated travel time based on distance and speed
     *
     * @param float $distance Distance in km
     * @param float $speedKmh Average speed in km/h (default: 15 km/h for motorcycle in city)
     * @return array ['minutes' => int, 'hours' => float, 'text' => string]
     */
    public function calculateETA($distance, $speedKmh = 15.0)
    {
        if ($distance <= 0) {
            return [
                'minutes' => 0,
                'hours' => 0,
                'text' => 'Arriving now'
            ];
        }

        $hours = $distance / $speedKmh;
        $minutes = round($hours * 60);

        $text = $this->formatETAText($minutes);

        return [
            'minutes' => $minutes,
            'hours' => round($hours, 1),
            'text' => $text
        ];
    }

    /**
     * Format ETA minutes into readable text
     *
     * @param int $minutes
     * @return string
     */
    private function formatETAText($minutes)
    {
        if ($minutes < 1) {
            return 'Less than 1 min';
        } elseif ($minutes < 60) {
            return $minutes . ' min';
        } else {
            $hours = floor($minutes / 60);
            $remainingMinutes = $minutes % 60;

            if ($remainingMinutes === 0) {
                return $hours . ' hr';
            } else {
                return $hours . ' hr ' . $remainingMinutes . ' min';
            }
        }
    }

    /**
     * Format distance with appropriate unit and precision
     *
     * @param float $distanceKm Distance in kilometers
     * @return string Formatted distance string
     */
    public function formatDistance($distanceKm)
    {
        if ($distanceKm < 1) {
            // Convert to meters for short distances
            $meters = round($distanceKm * 1000);
            return $meters . ' m';
        } elseif ($distanceKm < 10) {
            // Show one decimal for distances under 10km
            return round($distanceKm, 1) . ' km';
        } else {
            // Show whole numbers for longer distances
            return round($distanceKm) . ' km';
        }
    }
}
