<?php

namespace App\Services\Riders;

use App\Models\User;
use App\Models\Delivery;
use App\Models\RiderProfile;

class RiderQueryService
{
    /**
     * Get paginated list of all riders with stats and counts.
     */
    public function index($search = null, $status = null, $perPage = 20)
    {
        $query = User::where('role', 'rider')
            ->with(['riderProfile'])
            ->withCount([
                'deliveries as total_deliveries_count' => function ($q) {
                    $q->where('status', 'delivered');
                }
            ])
            ->withCount([
                'deliveries as active_deliveries_count' => function ($q) {
                    $q->whereIn('status', ['pending', 'in_progress']);
                }
            ])
            ->when($search, function ($q) use ($search) {
                return $q->where('name', 'like', "%{$search}%");
            })
            ->when($status, function ($q) use ($status) {
                return $q->where('status', $status);
            })
            ->latest();

        $riders = $query->paginate($perPage);

        return [
            'data' => $riders,
            'counts' => [
                'total' => User::where('role', 'rider')->count(),
                'available' => RiderProfile::where('availability', 'available')->count(),
                'on_delivery' => RiderProfile::where('availability', 'on_delivery')->count(),
                'off_duty' => RiderProfile::where('availability', 'off_duty')->count(),
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Get stats for a specific rider.
     */
    public function stats($riderId)
    {
        $user = User::with('riderProfile')->findOrFail($riderId);
        $profile = $user->riderProfile;

        $completedDeliveries = Delivery::where('rider_id', $riderId)->where('status', 'delivered')->count();
        $activeOrders = Delivery::where('rider_id', $riderId)->where('status', 'in_progress')->count();

        return [
            'data' => [
                'user' => $user,
                'profile' => $profile,
                'completed_deliveries' => $completedDeliveries,
                'active_orders' => $activeOrders,
                'on_time_rate' => $profile ? $profile->on_time_rate : 0,
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Get my deliveries for authenticated rider.
     */
    public function myDeliveries($riderId)
    {
        $deliveries = Delivery::with(['sale.customer', 'sale.items.product'])
            ->where('rider_id', $riderId)
            ->latest()
            ->get();

        return [
            'data' => $deliveries->toArray(),
            'status_code' => 200,
        ];
    }

    /**
     * Get rating stats for authenticated rider.
     */
    public function getRatingStats($riderId)
    {
        $ratings = Delivery::where('rider_id', $riderId)
            ->whereNotNull('rating')
            ->get(['rating', 'rating_comment', 'rated_at']);

        $averageRating = $ratings->avg('rating') ? round($ratings->avg('rating'), 2) : 0;
        $totalRatings = $ratings->count();
        $ratingDistribution = $ratings->countBy('rating');
        $recentRating = $ratings->last()->rating ?? null;
        $recentComment = $ratings->last()->rating_comment ?? null;
        $recentDate = $ratings->last()->rated_at ?? null;

        $ratingPercentages = [];
        for ($i = 1; $i <= 5; $i++) {
            $count = $ratingDistribution[$i] ?? 0;
            $ratingPercentages[$i] = $totalRatings > 0 ? round(($count / $totalRatings) * 100, 1) : 0;
        }

        return [
            'data' => [
                'average_rating' => $averageRating,
                'total_ratings' => $totalRatings,
                'rating_distribution' => $ratingDistribution,
                'recent_rating' => $recentRating,
                'recent_comment' => $recentComment,
                'recent_date' => $recentDate,
                'rating_percentages' => $ratingPercentages,
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Get all available riders (currently online).
     */
    public function availableRiders()
    {
        $riders = User::where('role', 'rider')
            ->with('riderProfile')
            ->withCount([
                'deliveries as active_deliveries_count' => function ($q) {
                    $q->whereIn('status', ['pending', 'in_progress']);
                }
            ])
            ->get();

        return [
            'data' => $riders,
            'status_code' => 200,
        ];
    }
}
