<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\RiderProfile;
use App\Models\CustomerNotification;
use App\Notifications\NewOrderAssigned;
use App\Notifications\NewFeedbackReceived;
use Illuminate\Http\Request;

class DeliveryController extends Controller
{
    public function index(Request $request)
    {
        $query = Delivery::with(['sale.customer', 'sale.items.product', 'rider'])
            ->when($request->status && $request->status !== 'all', function ($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->rider_id === 'me' && $request->user(), function ($q) use ($request) {
                return $q->where('rider_id', $request->user()->id);
            })
            ->when($request->rider_id && $request->rider_id !== 'me', function ($q) use ($request) {
                return $q->where('rider_id', $request->rider_id);
            });

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('tracking_number', 'like', "%{$request->search}%")
                  ->orWhere('address', 'like', "%{$request->search}%")
                  ->orWhereHas('sale', function ($sq) use ($request) {
                      $sq->where('order_number', 'like', "%{$request->search}%")
                         ->orWhereHas('customer', function ($cq) use ($request) {
                             $cq->where('name', 'like', "%{$request->search}%");
                         });
                  })
                  ->orWhereHas('rider', function ($rq) use ($request) {
                      $rq->where('name', 'like', "%{$request->search}%");
                  });
            });
        }

        $deliveries = $query->latest()->paginate($request->get('per_page', 15));

        $today = now()->toDateString();
        $stats = [
            'total' => Delivery::count(),
            'pending' => Delivery::where('status', 'pending')->count(),
            'in_progress' => Delivery::where('status', 'in_progress')->count(),
            'delivered' => Delivery::where('status', 'delivered')->count(),
            'failed' => Delivery::where('status', 'failed')->count(),
            'today_delivered' => Delivery::where('status', 'delivered')->whereDate('updated_at', $today)->count(),
        ];

        return response()->json([
            'data'   => $deliveries,
            'stats'  => $stats,
            'status' => 'success',
        ]);
    }

    public function show($id)
    {
        $delivery = Delivery::with(['sale.customer', 'sale.items.product', 'rider'])->findOrFail($id);
        return response()->json(['data' => $delivery, 'status' => 'success']);
    }

    public function destroy($id)
    {
        $delivery = Delivery::findOrFail($id);
        if ($delivery->status !== 'pending') {
            return response()->json(['message' => 'Only pending deliveries can be deleted.', 'status' => 'error'], 422);
        }
        $delivery->delete();
        return response()->json(['status' => 'success']);
    }

    public function assignRider(Request $request, $id)
    {
        $delivery = Delivery::findOrFail($id);
        $request->validate(['rider_id' => 'required|exists:users,id']);

        $delivery->update([
            'rider_id' => $request->rider_id,
            'status'   => 'in_progress',
        ]);

        // Update rider profile availability
        RiderProfile::where('user_id', $request->rider_id)
            ->update(['availability' => 'on_delivery']);

        // Notify Rider
        $delivery->rider->notify(new NewOrderAssigned($delivery));

        return response()->json([
            'data'    => $delivery->fresh()->load(['sale', 'rider']),
            'message' => 'Rider assigned successfully',
            'status'  => 'success',
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $delivery = Delivery::findOrFail($id);
        $request->validate(['status' => 'required|in:pending,in_progress,delivered,failed']);

        $updates = ['status' => $request->status];

        if ($request->status === 'in_progress') {
            $updates['pickup_at'] = now();
        }

        if ($request->status === 'delivered') {
            $updates['delivered_at'] = now();
            // Update sale status
            $delivery->sale->update(['status' => 'delivered']);
            // Update rider stats
            if ($delivery->rider_id) {
                $profile = RiderProfile::where('user_id', $delivery->rider_id)->first();
                if ($profile) {
                    $profile->increment('total_deliveries');
                    $profile->on_time_count += 1;
                    $profile->availability = 'available';
                    $profile->save();
                }
            }
            // Notify customer that delivery is complete
            if ($delivery->sale && $delivery->sale->customer_id) {
                CustomerNotification::create([
                    'customer_id' => $delivery->sale->customer_id,
                    'delivery_id' => $delivery->id,
                    'type' => 'delivered',
                    'message' => 'Your order has been delivered! Please rate your experience.',
                    'is_read' => false,
                ]);
            }
        }

        if ($request->status === 'failed') {
            // Free up the rider
            if ($delivery->rider_id) {
                RiderProfile::where('user_id', $delivery->rider_id)
                    ->update(['availability' => 'available']);
            }
        }

        $delivery->update($updates);

        return response()->json([
            'data'    => $delivery->fresh()->load(['sale', 'rider']),
            'message' => 'Delivery status updated',
            'status'  => 'success',
        ]);
    }

    /**
     * Rider sends their location; if within 1km of destination, notify the customer.
     */
    public function riderProximityUpdate(Request $request, $id)
    {
        $request->validate([
            'latitude'  => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        $delivery = Delivery::with(['sale.customer', 'rider'])->findOrFail($id);

        if (!$delivery->latitude || !$delivery->longitude) {
            return response()->json(['message' => 'Delivery has no destination coordinates', 'status' => 'skip']);
        }

        // Haversine distance in km
        $lat1 = deg2rad($request->latitude);
        $lon1 = deg2rad($request->longitude);
        $lat2 = deg2rad($delivery->latitude);
        $lon2 = deg2rad($delivery->longitude);

        $dlat = $lat2 - $lat1;
        $dlon = $lon2 - $lon1;
        $a = sin($dlat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dlon / 2) ** 2;
        $distance = 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a)); // km

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
                    'type'        => 'proximity',
                    'title'       => 'Rider is nearby!',
                    'message'     => "{$riderName} is approximately {$distanceStr} away from your location. Please prepare to receive your order.",
                    'meta'        => [
                        'distance_km'  => round($distance, 3),
                        'rider_name'   => $riderName,
                        'order_number' => $delivery->sale->order_number ?? null,
                    ],
                ]);
                $notified = true;
            }
        }

        return response()->json([
            'distance_km' => round($distance, 3),
            'notified'    => $notified,
            'status'      => 'success',
        ]);
    }

    /**
     * Customer polls for their unread notifications.
     */
    public function customerNotifications(Request $request)
    {
        $notifications = CustomerNotification::where('customer_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        return response()->json([
            'data'   => $notifications,
            'unread' => $notifications->where('is_read', false)->count(),
            'status' => 'success',
        ]);
    }

    /**
     * Customer marks notifications as read.
     */
    public function markNotificationsRead(Request $request)
    {
        CustomerNotification::where('customer_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['status' => 'success']);
    }

    /**
     * Customer submits rating for delivery.
     */
    public function submitRating(Request $request, $id)
    {
        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        $delivery = Delivery::findOrFail($id);

        // Verify customer owns this delivery
        if ($delivery->sale->customer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Only allow rating if delivered
        if ($delivery->status !== 'delivered') {
            return response()->json(['message' => 'Can only rate delivered orders'], 400);
        }

        $delivery->update([
            'rating' => $request->rating,
            'rating_comment' => $request->comment,
            'rated_at' => now(),
        ]);

        // Notify Rider
        if ($delivery->rider) {
            $delivery->rider->notify(new NewFeedbackReceived($delivery));
        }

        return response()->json([
            'data' => $delivery,
            'status' => 'success',
            'message' => 'Thank you for your feedback!',
        ]);
    }

    /**
     * Rider uploads proof-of-delivery photo.
     */
    public function uploadProof(Request $request, $id)
    {
        $request->validate([
            'photo' => 'required|image|max:5120', // 5MB max
        ]);

        $delivery = Delivery::findOrFail($id);

        // Verify rider owns this delivery
        if ($delivery->rider_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Store photo
        $path = $request->file('photo')->store('delivery-proofs', 'public');

        $delivery->update([
            'proof_photo' => $path,
        ]);

        return response()->json([
            'data' => ['photo_url' => asset('storage/' . $path)],
            'status' => 'success',
            'message' => 'Proof photo uploaded successfully',
        ]);
    }
}
