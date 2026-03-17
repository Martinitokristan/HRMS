<?php

namespace App\Http\Controllers;

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

        // Update rider's current location if provided
        if ($request->has(['latitude', 'longitude'])) {
            $profile = RiderProfile::where('user_id', $riderId)->first();
            if ($profile) {
                $profile->current_latitude = $request->latitude;
                $profile->current_longitude = $request->longitude;
                $profile->save();
            }
        }

        $stats = [
            'total'     => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->count(),
            'done'      => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'delivered')->count(),
            'active'    => Delivery::where('rider_id', $riderId)->whereIn('status', ['pending', 'in_progress'])->count(),
            'failed'    => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'failed')->count(),
            'quota'     => 10000,
            'collected' => Delivery::where('rider_id', $riderId)->where('created_at', '>=', $today)->where('status', 'delivered')->with('sale')->get()->sum(function($d) {
                return optional($d->sale)->payment_method === 'cod' ? $d->sale->total_amount : 0;
            }),
        ];

        $deliveries = Delivery::with(['sale.customer.customerProfile', 'sale.items.product'])
            ->where('rider_id', $riderId)
            ->latest()
            ->get();

        // Get rider's current location for distance calculations
        $riderProfile = RiderProfile::where('user_id', $riderId)->first();
        $riderLat = $riderProfile->current_latitude ?? 7.0707; // Default Davao coordinates
        $riderLon = $riderProfile->current_longitude ?? 125.6080;

        $distanceCalculator = app(\App\Services\DistanceCalculator::class);

        $nearby = Delivery::with(['sale.customer.customerProfile', 'sale.items.product'])
            ->whereNull('rider_id')
            ->where('status', 'pending')
            ->latest()
            ->get()
            ->map(function($d) use ($riderLat, $riderLon, $distanceCalculator) {
                // Use real coordinates from customer profile, or fallback to mock
                $profile = $d->sale->customer->customerProfile;

                $customerLat = $profile->latitude ?? (7.07 + (rand(-10, 10) / 1000));
                $customerLon = $profile->longitude ?? (125.60 + (rand(-10, 10) / 1000));

                // Calculate real distance using Haversine formula
                $distanceKm = $distanceCalculator->calculateDistance($riderLat, $riderLon, $customerLat, $customerLon);
                $d->latitude = $customerLat;
                $d->longitude = $customerLon;
                $d->distance = $distanceCalculator->formatDistance($distanceKm);
                $d->distance_value = $distanceKm; // For sorting

                // Calculate ETA (assuming 15 km/h average speed)
                $eta = $distanceCalculator->calculateETA($distanceKm);
                $d->eta = $eta['text'];

                return $d;
            })
            ->sortBy('distance_value') // Sort by actual distance (closest first)
            ->values();

        return response()->json([
            'data' => [
                'stats'     => $stats,
                'nearby'    => $nearby,
                'my_jobs'   => $deliveries->whereIn('status', ['pending', 'in_progress'])->values(),
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

        return response()->json(['status' => 'success', 'message' => 'Interview scheduled successfully.']);
    }

    public function approveRider($id)
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'active']);
        
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
}
