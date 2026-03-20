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
            'status'   => 'pending',
        ]);

        // Do NOT set on_delivery yet — rider must accept first (in_progress transition does this)

        // Notify Rider
        $delivery->rider->notify(new NewOrderAssigned($delivery));

        return response()->json([
            'data'    => $delivery->fresh()->load(['sale', 'rider']),
            'message' => 'Rider assigned successfully',
            'status'  => 'success',
        ]);
    }

    public function selfAssign(Request $request, $id)
    {
        $rider = $request->user();
        
        // Verify user is a rider
        if ($rider->role !== 'rider') {
            return response()->json(['error' => 'Unauthorized - must be a rider'], 403);
        }

        $delivery = Delivery::findOrFail($id);
        
        // Verify delivery is not already assigned
        if ($delivery->rider_id) {
            return response()->json(['error' => 'Order already assigned'], 400);
        }

        // Verify delivery is pending
        if ($delivery->status !== 'pending') {
            return response()->json(['error' => 'Order not available for assignment'], 400);
        }

        // Assign the rider
        $delivery->update([
            'rider_id' => $rider->id,
            'status'   => 'pending', // Still pending until rider accepts
        ]);

        // Update rider availability
        RiderProfile::where('user_id', $rider->id)->update(['availability' => 'on_delivery']);

        // Notify customer that rider has been assigned
        CustomerNotification::create([
            'customer_id' => $delivery->sale->customer_id,
            'title' => 'Rider Assigned',
            'message' => "A rider has been assigned to your order #{$delivery->tracking_number}",
            'type' => 'rider_assigned'
        ]);

        return response()->json([
            'data'    => $delivery->fresh()->load(['sale', 'rider']),
            'message' => 'Order assigned successfully! Please accept to start delivery.',
            'status'  => 'success',
        ]);
    }

    public function declineOrder(Request $request, $id)
    {
        $request->validate(['note' => 'required|string|max:500']);
        
        $rider = $request->user();
        
        // Verify user is a rider
        if ($rider->role !== 'rider') {
            return response()->json(['error' => 'Unauthorized - must be a rider'], 403);
        }

        $delivery = Delivery::findOrFail($id);
        
        // Verify this delivery is assigned to this rider
        if ($delivery->rider_id !== $rider->id) {
            return response()->json(['error' => 'This order is not assigned to you'], 400);
        }

        // Verify delivery is still pending
        if (!in_array($delivery->status, ['pending', 'assigned'])) {
            return response()->json(['error' => 'Order cannot be declined'], 400);
        }

        // Remove rider assignment and make available again
        $delivery->update([
            'rider_id' => null,
            'status'   => 'pending',
            'notes'    => ($delivery->notes ? $delivery->notes . "\n" : '') . "Declined by rider: {$request->note}"
        ]);

        // Update rider availability back to available
        RiderProfile::where('user_id', $rider->id)->update(['availability' => 'available']);

        // Notify admin about the decline
        CustomerNotification::create([
            'customer_id' => $delivery->sale->customer_id,
            'title' => 'Rider Declined Order',
            'message' => "The assigned rider declined your order #{$delivery->tracking_number}. Reason: {$request->note}",
            'type' => 'rider_declined'
        ]);

        return response()->json([
            'message' => 'Order declined successfully',
            'status'  => 'success',
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $delivery = Delivery::findOrFail($id);
        
        // Verify this delivery belongs to the authenticated rider
        if ($delivery->rider_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized - You can only update your own deliveries'], 403);
        }
        
        $request->validate(['status' => 'required|in:pending,in_progress,delivered,failed']);

        $updates = ['status' => $request->status];

        if ($request->status === 'in_progress') {
            $updates['pickup_at'] = now();
            // Mark rider as on_delivery when they accept
            if ($delivery->rider_id) {
                RiderProfile::where('user_id', $delivery->rider_id)
                    ->update(['availability' => 'on_delivery']);
            }
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
                    'title' => 'Order Delivered',
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
     * Get current rider location for a delivery.
     */
    public function getRiderLocation(Request $request, $id)
    {
        $delivery = Delivery::findOrFail($id);
        
        // Verify this delivery belongs to the authenticated customer
        if ($delivery->sale->customer_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!$delivery->rider_id) {
            return response()->json(['data' => null]);
        }

        $riderProfile = RiderProfile::where('user_id', $delivery->rider_id)->first();
        
        if (!$riderProfile || !$riderProfile->current_latitude || !$riderProfile->current_longitude) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => [
                'latitude' => $riderProfile->current_latitude,
                'longitude' => $riderProfile->current_longitude,
                'updated_at' => $riderProfile->updated_at
            ]
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

        // Notify customer that proof photo has been uploaded
        if ($delivery->sale && $delivery->sale->customer_id) {
            CustomerNotification::create([
                'customer_id' => $delivery->sale->customer_id,
                'delivery_id' => $delivery->id,
                'type' => 'proof_uploaded',
                'title' => 'Delivery Proof Uploaded',
                'message' => 'Your rider has uploaded a proof photo for your delivery.',
                'is_read' => false,
            ]);
        }

        return response()->json([
            'data' => ['photo_url' => asset('storage/' . $path)],
            'status' => 'success',
            'message' => 'Proof photo uploaded successfully',
        ]);
    }

    public function updateLocation(Request $request, $id)
    {
        $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
        ]);

        $delivery = Delivery::where('id', $id)
            ->where('rider_id', $request->user()->id)
            ->where('status', 'in_progress')
            ->firstOrFail();

        $delivery->update([
            'rider_latitude' => $request->latitude,
            'rider_longitude' => $request->longitude,
        ]);

        // Broadcast location update to customer
        broadcast(new \App\Events\RiderLocationUpdated($delivery));

        return response()->json([
            'message' => 'Location updated successfully',
            'status' => 'success',
        ]);
    }

    public function getActiveDelivery(Request $request)
    {
        $delivery = Delivery::with(['sale.customer', 'sale.items.product'])
            ->where('rider_id', $request->user()->id)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->first();

        return response()->json([
            'data' => $delivery,
            'status' => 'success',
        ]);
    }
}
