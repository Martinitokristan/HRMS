<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Models\Delivery;
use App\Models\RiderProfile;
use App\Models\User;
use Illuminate\Http\Request;

class RiderController extends Controller
{
    public function index(Request $request)
    {
        $query = User::where('role', 'rider')
            ->with(['riderProfile'])
            ->withCount(['deliveries as total_deliveries_count' => function($q) {
                $q->where('status', 'delivered');
            }])
            ->withCount(['deliveries as active_deliveries_count' => function($q) {
                $q->whereIn('status', ['pending', 'in_progress']);
            }])
            ->when($request->search, function($q) use ($request) {
                return $q->where('name', 'like', "%{$request->search}%");
            })
            ->when($request->status, function($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->latest();

        return response()->json([
            'data'   => $query->paginate($request->get('per_page', 15)),
            'counts' => [
                'total'       => User::where('role', 'rider')->count(),
                'available'   => RiderProfile::where('availability', 'available')->count(),
                'on_delivery' => RiderProfile::where('availability', 'on_delivery')->count(),
                'off_duty'    => RiderProfile::where('availability', 'off_duty')->count(),
            ],
            'status' => 'success',
        ]);
    }

    public function stats($id)
    {
        $user = User::with('riderProfile')->findOrFail($id);
        $profile = $user->riderProfile;

        $completedDeliveries = Delivery::where('rider_id', $id)->where('status', 'delivered')->count();
        $activeOrders = Delivery::where('rider_id', $id)->where('status', 'in_progress')->count();

        return response()->json([
            'data' => [
                'user'                  => $user,
                'profile'               => $profile,
                'completed_deliveries'  => $completedDeliveries,
                'active_orders'         => $activeOrders,
                'on_time_rate'          => $profile ? $profile->on_time_rate : 0,
            ],
            'status' => 'success',
        ]);
    }

    public function myDeliveries(Request $request)
    {
        $deliveries = Delivery::with(['sale.customer', 'sale.items.product'])
            ->where('rider_id', $request->user()->id)
            ->latest()
            ->get();
        return response()->json(['data' => $deliveries, 'status' => 'success']);
    }

    public function getRatingStats(Request $request)
    {
        $riderId = $request->user()->id;
        
        \Log::info('Fetching rating stats for rider: ' . $riderId);
        
        $ratings = Delivery::where('rider_id', $riderId)
            ->whereNotNull('rating')
            ->get(['rating', 'rating_comment', 'rated_at']);

        \Log::info('Found ratings count: ' . $ratings->count());
        
        $averageRating = $ratings->avg('rating') ? round($ratings->avg('rating'), 2) : 0;
        $totalRatings = $ratings->count();
        $ratingDistribution = $ratings->countBy('rating');
        $recentRating = $ratings->last()->rating ?? null;
        $recentComment = $ratings->last()->rating_comment ?? null;
        $recentDate = $ratings->last()->rated_at ?? null;
        
        // Calculate rating percentages
        $ratingPercentages = [];
        for ($i = 1; $i <= 5; $i++) {
            $count = $ratingDistribution[$i] ?? 0;
            $ratingPercentages[$i] = $totalRatings > 0 ? round(($count / $totalRatings) * 100, 1) : 0;
        }
        
        $ratingStats = [
            'average_rating' => $averageRating,
            'total_ratings' => $totalRatings,
            'rating_distribution' => $ratingDistribution,
            'recent_rating' => $recentRating,
            'recent_comment' => $recentComment,
            'recent_date' => $recentDate,
            'rating_percentages' => $ratingPercentages,
        ];
        
        return response()->json([
            'data' => $ratingStats,
            'status' => 'success'
        ]);
    }

    public function toggleStatus(Request $request)
    {
        $profile = RiderProfile::where('user_id', $request->user()->id)->first();
        if ($profile) {
            $profile->availability = $profile->availability === 'off_duty' ? 'available' : 'off_duty';
            $profile->save();
        }
        return response()->json(['status' => 'success']);
    }
    public function availableRiders()
    {
        $riders = User::where('role', 'rider')
            // Remove manual off_duty check as per request ("always online if logged in")
            ->with('riderProfile')
            ->withCount(['deliveries as active_deliveries_count' => function ($q) {
                $q->whereIn('status', ['pending', 'in_progress']);
            }])
            ->get();
            
        return response()->json([
            'data'   => $riders,
            'status' => 'success'
        ]);
    }

    public function dashboard(Request $request)
    {
        $riderId = $request->user()->id;
        $today = now()->startOfDay();

        \Log::debug('Rider dashboard call. User: ' . $riderId . '. Params: ' . json_encode($request->all()));

        // Update rider's current location if provided
        if ($request->has('latitude') && $request->has('longitude')) {
            \Log::debug("Updating rider {$riderId} location: " . $request->latitude . ", " . $request->longitude);
            $profile = RiderProfile::where('user_id', $riderId)->first();
            if ($profile) {
                $profile->current_latitude = (float)$request->latitude;
                $profile->current_longitude = (float)$request->longitude;
                $profile->current_heading = (float)($request->heading ?? 0);
                $profile->save();
                \Log::debug("Rider profile saved for user {$riderId}");

                // Broadcast location update to all active deliveries
                $activeDeliveries = \App\Models\Delivery::where('rider_id', $riderId)
                    ->whereIn('status', ['confirmed', 'in_progress'])
                    ->with('sale')
                    ->get();
                
                foreach ($activeDeliveries as $delivery) {
                    if ($delivery->sale && $delivery->sale->customer_id) {
                        broadcast(new \App\Events\RiderLocationUpdated(
                            $delivery->sale->customer_id,
                            $riderId,
                            $request->latitude,
                            $request->longitude,
                            $request->heading ?? 0,
                            $delivery->tracking_number
                        ));
                    }
                }
            }
        }

        $stats = [
            'total'     => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->count(),
            'done'      => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'delivered')->count(),
            'active'    => Delivery::where('rider_id', $riderId)->whereIn('status', ['pending', 'confirmed', 'in_progress'])->count(),
            'failed'    => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'failed')->count(),
            'quota'     => 10000,
            'collected' => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'delivered')->with('sale')->get()->sum(function($d) {
                return optional($d->sale)->payment_method === 'cod' ? $d->sale->total_amount : 0;
            }),
        ];

        // Get rider's current location for distance calculations
        // If the request includes GPS coords (sent by frontend on every dashboard fetch), use and persist them
        $riderProfile = RiderProfile::where('user_id', $riderId)->first();
        if ($request->filled('latitude') && $request->filled('longitude') && $riderProfile) {
            $riderProfile->current_latitude  = (float) $request->latitude;
            $riderProfile->current_longitude = (float) $request->longitude;
            $riderProfile->current_heading   = (float) ($request->heading ?? 0);
            $riderProfile->save();
        }
        $riderLat = $riderProfile->current_latitude ?? null;
        $riderLon = $riderProfile->current_longitude ?? null;
        $riderHasGps = $riderLat !== null && $riderLon !== null;

        $distanceCalculator = app(\App\Services\DistanceCalculator::class);

        $deliveries = Delivery::with(['sale.customer.customerProfile', 'sale.items.product'])
            ->where('rider_id', $riderId)
            ->latest()
            ->get()
            ->map(function($d) use ($riderLat, $riderLon, $riderHasGps, $distanceCalculator) {
                // Retrieve customer profile
                $profile = $d->sale->customer->customerProfile;

                // Bind customer name and address directly for easy frontend access
                $d->customer_name = optional($d->sale->customer)->name ?? 'Unknown Customer';
                $d->customer_address = $d->address ?? 'No Address Provided';

                $d->customer_latitude = $profile->latitude ?? null;
                $d->customer_longitude = $profile->longitude ?? null;

                // Only calculate distance if both rider and customer have real GPS coordinates
                if ($riderHasGps && $d->customer_latitude !== null && $d->customer_longitude !== null) {
                    $distanceKm = $distanceCalculator->calculateDistance($riderLat, $riderLon, $d->customer_latitude, $d->customer_longitude);
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

        $nearby = Delivery::with(['sale.customer.customerProfile', 'sale.items.product'])
            ->whereNull('rider_id')
            ->where('status', 'pending')
            ->latest()
            ->get()
            ->map(function($d) use ($riderLat, $riderLon, $riderHasGps, $distanceCalculator) {
                $profile = $d->sale->customer->customerProfile;

                $d->customer_name = optional($d->sale->customer)->name ?? 'Unknown Customer';
                $d->customer_address = $d->address ?? 'No Address Provided';

                $customerLat = $profile->latitude ?? null;
                $customerLon = $profile->longitude ?? null;

                $d->latitude = $customerLat;
                $d->longitude = $customerLon;

                // Only calculate distance if both rider and customer have real GPS coordinates
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
            })
            ->sortBy(fn($d) => $d->distance_value ?? PHP_INT_MAX)
            ->values();

        return response()->json([
            'data' => [
                'stats'     => $stats,
                'nearby'    => $nearby,
                'my_jobs'   => $deliveries->whereIn('status', ['pending', 'confirmed', 'in_progress'])->values(),
                'completed' => $deliveries->whereIn('status', ['delivered', 'failed'])->take(20)->values(),
            ],
            'status' => 'success'
        ]);
    }

    public function scheduleInterview(Request $request, $id)
    {
        $request->validate(['interview_at' => 'required|date']);
        $user = User::findOrFail($id);
        $user->update(['status' => 'interview_set']);
        $user->riderProfile()->update(['interview_at' => $request->interview_at]);

        // TODO: Send email notification to the rider

        broadcast(new DataMutated('private-admin', ['admin_users', 'admin_riders'], 'rider.interview_scheduled'));
        broadcast(new DataMutated("private-rider.{$user->id}", ['rider_dashboard', 'rider_notifications'], 'rider.interview_scheduled'));

        return response()->json(['status' => 'success', 'message' => 'Interview scheduled successfully.']);
    }

    public function approveRider($id)
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'active']);
        
        broadcast(new DataMutated('private-admin', ['admin_users', 'admin_riders'], 'rider.approved'));
        broadcast(new DataMutated("private-rider.{$user->id}", ['rider_dashboard', 'rider_notifications'], 'rider.approved'));

        return response()->json(['status' => 'success', 'message' => 'Rider hired and activated!']);
    }
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
        ]);

        $user->update([
            'name' => $request->name,
            'phone' => $request->phone,
        ]);

        if ($request->has('address')) {
            $user->riderProfile()->updateOrCreate(
                ['user_id' => $user->id],
                ['address' => $request->address]
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Profile updated successfully',
            'user' => $user->load('riderProfile')
        ]);
    }

    public function updatePhoto(Request $request)
    {
        $request->validate([
            'photo' => 'required|image|max:2048',
        ]);

        $user = $request->user();
        $path = $request->file('photo')->store('profile-photos', 'public');
        
        $user->update(['photo' => $path]);

        return response()->json([
            'status' => 'success',
            'message' => 'Photo updated successfully',
            'photo_url' => asset('storage/' . $path),
            'user' => $user->load('riderProfile')
        ]);
    }

    public function updateSecurity(Request $request)
    {
        $request->validate([
            'current_password' => 'required|current_password',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $request->user()->update([
            'password' => bcrypt($request->password)
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Password changed successfully'
        ]);
    }

    public function getNotifications(Request $request)
    {
        $notifications = $request->user()->notifications()->latest()->limit(50)->get();
        return response()->json([
            'status' => 'success',
            'data' => $notifications,
            'unread_count' => $request->user()->unreadNotifications()->count()
        ]);
    }

    public function markNotificationsRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();
        return response()->json(['status' => 'success']);
    }

    public function deleteNotification(Request $request, $id)
    {
        $request->user()->notifications()->where('id', $id)->delete();
        return response()->json(['status' => 'success']);
    }

    public function deleteBatchNotifications(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        $request->user()->notifications()->whereIn('id', $request->ids)->delete();
        return response()->json(['status' => 'success']);
    }

    public function deleteAllNotifications(Request $request)
    {
        $request->user()->notifications()->delete();
        return response()->json(['status' => 'success']);
    }

    public function updateLocation(Request $request)
    {
        $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'broadcast' => 'boolean'
        ]);

        $riderId = $request->user()->id;
        $profile = RiderProfile::where('user_id', $riderId)->first();
        
        if ($profile) {
            $profile->current_latitude = $request->latitude;
            $profile->current_longitude = $request->longitude;
            $profile->save();
        }

        // Real-time broadcasting if enabled
        if ($request->boolean('broadcast')) {
            // Broadcast to all active deliveries for this rider
            $activeDeliveries = \App\Models\Delivery::where('rider_id', $riderId)
                ->whereIn('status', ['pending', 'in_progress'])
                ->with('sale.customer')
                ->get();

            foreach ($activeDeliveries as $delivery) {
                // Broadcast to customer's channel
                broadcast(new \App\Events\RiderLocationUpdated(
                    $delivery->sale->customer_id,
                    $riderId,
                    $request->latitude,
                    $request->longitude,
                    $delivery->tracking_number
                ));
            }
        }

        return response()->json(['status' => 'success']);
    }
}
