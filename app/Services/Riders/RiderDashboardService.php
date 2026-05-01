<?php

namespace App\Services\Riders;

use App\Models\Delivery;
use App\Models\RiderProfile;

class RiderDashboardService
{
    /**
     * Get comprehensive rider dashboard with deliveries and nearby jobs.
     */
    public function getDashboard($riderId, $latitude = null, $longitude = null)
    {
        try {
            $today = now()->startOfDay();

            if (!is_null($latitude) && !is_null($longitude)) {
                $profile = RiderProfile::where('user_id', $riderId)->first();
                if ($profile) {
                    $profile->current_latitude = (float) $latitude;
                    $profile->current_longitude = (float) $longitude;
                    $profile->save();

                    $activeDeliveries = Delivery::where('rider_id', $riderId)
                        ->whereIn('status', ['confirmed', 'in_progress'])
                        ->with('sale')
                        ->get();

                    foreach ($activeDeliveries as $delivery) {
                        if ($delivery->sale && $delivery->sale->customer_id) {
                            broadcast(new \App\Events\RiderLocationUpdated(
                                $delivery->sale->customer_id,
                                $riderId,
                                $latitude,
                                $longitude,
                                0,
                                $delivery->tracking_number ?? 0
                            ));
                        }
                    }
                }
            }

            $stats = $this->buildDashboardStats($riderId, $today);
            $riderProfile = RiderProfile::where('user_id', $riderId)->first();
            $riderLat = $riderProfile ? $riderProfile->current_latitude : null;
            $riderLon = $riderProfile ? $riderProfile->current_longitude : null;
            $riderHasGps = $riderLat !== null && $riderLon !== null;

            $distanceCalculator = app(\App\Services\DistanceCalculator::class);

            $deliveries = $this->enrichDeliveries(
                Delivery::with(['sale.customer.customerProfile', 'sale.items.product'])
                    ->where('rider_id', $riderId)
                    ->latest()
                    ->get(),
                $riderLat,
                $riderLon,
                $riderHasGps,
                $distanceCalculator,
                true
            );

            $nearby = $this->enrichDeliveries(
                Delivery::with(['sale.customer.customerProfile', 'sale.items.product'])
                    ->whereNull('rider_id')
                    ->where('status', 'pending')
                    ->latest()
                    ->get(),
                $riderLat,
                $riderLon,
                $riderHasGps,
                $distanceCalculator,
                false
            )
                ->sortBy(fn($d) => $d['distance_value'] ?? PHP_INT_MAX)
                ->values();

            $myJobs = $this->filterMyJobs($deliveries);
            $completed = $this->filterCompleted($deliveries);

            return [
                'data' => [
                    'stats' => $stats,
                    'nearby' => $nearby,
                    'my_jobs' => $myJobs,
                    'completed' => $completed,
                ],
                'status_code' => 200,
            ];
        } catch (\Exception $e) {
            return [
                'error' => 'Failed to load dashboard',
                'message' => $e->getMessage(),
                'status_code' => 500,
            ];
        }
    }

    /**
     * Build dashboard statistics for the rider.
     */
    private function buildDashboardStats($riderId, $today)
    {
        $manilaToday = now('Asia/Manila');
        $utcStart = $manilaToday->copy()->startOfDay()->setTimezone('UTC');
        $utcEnd = $manilaToday->copy()->endOfDay()->setTimezone('UTC');

        return [
            'total' => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->count(),
            'done' => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'delivered')->count(),
            'active' => Delivery::where('rider_id', $riderId)->whereIn('status', ['confirmed', 'in_progress'])->count(),
            'failed' => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'failed')->count(),
            'quota' => 10000,
            'collected' => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'delivered')->with('sale')->get()->sum(function ($d) {
                return optional($d->sale)->payment_method === 'cod' ? $d->sale->total_amount : 0;
            }),
            'today_earnings' => (float) Delivery::where('rider_id', $riderId)
                ->where('created_at', '>=', $today)
                ->where('status', 'delivered')
                ->whereIn('payout_status', ['eligible', 'paid'])
                ->sum('delivery_fee'),
            'cash_to_remit_today' => (float) Delivery::where('rider_id', $riderId)
                ->whereBetween('delivered_at', [$utcStart, $utcEnd])
                ->where('status', 'delivered')
                ->whereHas('sale', function ($q) {
                    $q->where('payment_method', 'cod');
                })
                ->whereNull('cash_remitted_at')
                ->sum('cash_collected'),
        ];
    }

    /**
     * Enrich deliveries with distance and ETA calculations.
     */
    private function enrichDeliveries($deliveries, $riderLat, $riderLon, $riderHasGps, $distanceCalculator, $isMyJob)
    {
        return $deliveries->map(function ($d) use ($riderLat, $riderLon, $riderHasGps, $distanceCalculator, $isMyJob) {
            if (!$d->sale || !$d->sale->customer) {
                $d->customer_name = 'Unknown Customer';
                $d->customer_address = $d->address ?? 'No Address Provided';
                $d->distance = null;
                $d->distance_value = null;
                $d->eta = null;
                return $d;
            }

            $profile = optional($d->sale->customer)->customerProfile;
            $d->customer_name = optional($d->sale->customer)->name ?? 'Unknown Customer';
            $d->customer_address = $d->address ?? 'No Address Provided';

            if ($isMyJob) {
                $d->customer_latitude = optional($profile)->latitude ?? null;
                $d->customer_longitude = optional($profile)->longitude ?? null;
            } else {
                $d->latitude = optional($profile)->latitude ?? null;
                $d->longitude = optional($profile)->longitude ?? null;
            }

            $customerLat = $isMyJob ? $d->customer_latitude : $d->latitude;
            $customerLon = $isMyJob ? $d->customer_longitude : $d->longitude;

            if ($riderHasGps && $customerLat !== null && $customerLon !== null) {
                $distanceKm = $distanceCalculator->calculateDistance($riderLat, $riderLon, $customerLat, $customerLon);
                $d->distance = $distanceCalculator->formatDistance($distanceKm);
                $d->distance_value = $distanceKm;
                $eta = $distanceCalculator->calculateETA($distanceKm);
                $d->eta = $eta['text'];
            } else {
                $d->distance = null;
                $d->distance_value = null;
                $d->eta = null;
            }

            return $d;
        });
    }

    /**
     * Filter active job deliveries.
     */
    private function filterMyJobs($deliveries)
    {
        return $deliveries->filter(function ($d) {
            if (in_array($d->status, ['pending', 'confirmed', 'in_progress'])) {
                return true;
            }
            if ($d->status === 'delivered' && empty($d->proof_photo)) {
                return true;
            }
            return false;
        })->values();
    }

    /**
     * Filter completed job deliveries.
     */
    private function filterCompleted($deliveries)
    {
        return $deliveries->filter(function ($d) {
            if ($d->status === 'failed') {
                return true;
            }
            if ($d->status === 'delivered' && !empty($d->proof_photo)) {
                return true;
            }
            return false;
        })->take(20)->values();
    }
}
