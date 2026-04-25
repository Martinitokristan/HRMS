<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Models\Delivery;
use App\Models\RiderProfile;
use App\Models\CustomerNotification;
use App\Notifications\NewOrderAssigned;
use App\Notifications\NewFeedbackReceived;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

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

        $deliveries = $query->latest()->paginate($request->get('per_page', 20));

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
            'data' => $deliveries,
            'stats' => $stats,
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
            'status' => 'pending',
        ]);

        // Do NOT set on_delivery yet — rider must accept first (in_progress transition does this)

        // Notify Rider
        $delivery->rider->notify(new NewOrderAssigned($delivery));

        $riderId = $request->rider_id;
        $customerId = $delivery->sale->customer_id ?? null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard'], 'delivery.rider_assigned'));
        broadcast(new DataMutated("private-rider.{$riderId}", ['rider_dashboard', 'rider_notifications'], 'delivery.rider_assigned'));
        if ($customerId)
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.rider_assigned'));

        return response()->json([
            'data' => $delivery->fresh()->load(['sale', 'rider']),
            'message' => 'Rider assigned successfully',
            'status' => 'success',
        ]);
    }

    public function selfAssign(Request $request, $id)
    {
        $rider = $request->user();

        // Verify user is a rider
        if ($rider->role !== 'rider') {
            return response()->json(['error' => 'Unauthorized - must be a rider'], 403);
        }

        // Strictly scope the query to unassigned, pending deliveries to prevent IDOR
        $delivery = Delivery::where('status', 'pending')
            ->whereNull('rider_id')
            ->findOrFail($id);

        // Assign the rider
        $delivery->update([
            'rider_id' => $rider->id,
            'status' => 'confirmed', // Rider accepted
        ]);

        // Update sale status to confirmed
        $delivery->sale->update(['status' => 'confirmed']);

        // Update rider availability
        RiderProfile::where('user_id', $rider->id)->update(['availability' => 'on_delivery']);

        // Notify customer that rider has been assigned
        CustomerNotification::create([
            'customer_id' => $delivery->sale->customer_id,
            'title' => 'Rider Assigned',
            'message' => "A rider has accepted your order #{$delivery->tracking_number} and is preparing for pickup.",
            'type' => 'rider_assigned'
        ]);

        $customerId = $delivery->sale->customer_id ?? null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard', 'admin_orders'], 'delivery.self_assigned'));
        broadcast(new DataMutated("private-rider.{$rider->id}", ['rider_dashboard'], 'delivery.self_assigned'));
        if ($customerId)
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.self_assigned'));

        return response()->json([
            'data' => $delivery->fresh()->load(['sale', 'rider']),
            'message' => 'Order assigned successfully! Please accept to start delivery.',
            'status' => 'success',
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

        // Strictly scope the query to this rider's deliveries to prevent IDOR
        $delivery = Delivery::where('rider_id', $rider->id)
            ->whereIn('status', ['pending', 'assigned'])
            ->findOrFail($id);

        // Remove rider assignment and make available again
        $delivery->update([
            'rider_id' => null,
            'status' => 'pending',
            'notes' => ($delivery->notes ? $delivery->notes . "\n" : '') . "Declined by rider: {$request->note}"
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

        $customerId = $delivery->sale->customer_id ?? null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard'], 'delivery.declined'));
        broadcast(new DataMutated("private-rider.{$rider->id}", ['rider_dashboard'], 'delivery.declined'));
        if ($customerId)
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.declined'));

        return response()->json([
            'message' => 'Order declined successfully',
            'status' => 'success',
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $delivery = Delivery::findOrFail($id);

        // Verify this delivery belongs to the authenticated rider
        if ($delivery->rider_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized - You can only update your own deliveries'], 403);
        }

        $request->validate([
            'status' => 'required|in:pending,in_progress,delivered,failed',
            'rider_latitude'  => 'nullable|numeric|between:-90,90',
            'rider_longitude' => 'nullable|numeric|between:-180,180',
        ]);

        $updates = ['status' => $request->status];

        if ($request->status === 'in_progress') {
            $updates['pickup_at'] = now();
            // Update sale status to out_for_delivery
            if ($delivery->sale) {
                $delivery->sale->update(['status' => 'out_for_delivery']);
            }
            // Mark rider as on_delivery when they accept
            if ($delivery->rider_id) {
                RiderProfile::where('user_id', $delivery->rider_id)
                    ->update(['availability' => 'on_delivery']);
            }
        }

        if ($request->status === 'delivered') {
            $updates['delivered_at'] = now();
            // Update sale status
            if ($delivery->sale) {
                $delivery->sale->update(['status' => 'delivered']);
            }
            try {
                Cache::tags(['products'])->flush();
            } catch (\BadMethodCallException $e) {
                Cache::forget('products:all');
            }
            // Free up the rider
            if ($delivery->rider_id) {
                RiderProfile::where('user_id', $delivery->rider_id)
                    ->update(['availability' => 'available']);
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

        // Wave 6 — geofence stamp + customer-confirm notification + payout-eligibility check.
        if ($request->status === 'delivered') {
            $this->stampGeofence($delivery->fresh(), $request->input('rider_latitude'), $request->input('rider_longitude'));
            $this->postCustomerConfirmationNotification($delivery->fresh());
            $this->maybePromoteToEligible($delivery->fresh());
        }

        $riderId = $request->user()->id;
        $customerId = $delivery->sale ? $delivery->sale->customer_id : null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard', 'admin_orders'], 'delivery.status_updated'));
        broadcast(new DataMutated("private-rider.{$riderId}", ['rider_dashboard'], 'delivery.status_updated'));
        if ($customerId)
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.status_updated'));

        return response()->json([
            'data' => $delivery->fresh()->load(['sale', 'rider']),
            'message' => 'Delivery status updated',
            'status' => 'success',
        ]);
    }

    /**
     * Rider sends their location; if within 1km of destination, notify the customer.
     */
    public function riderProximityUpdate(Request $request, $id)
    {
        $request->validate([
            'latitude' => 'required|numeric',
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

        return response()->json([
            'distance_km' => round($distance, 3),
            'notified' => $notified,
            'status' => 'success',
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
            'data' => $notifications,
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
                'heading' => $riderProfile->current_heading,
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

    public function deleteNotification(Request $request, $id)
    {
        CustomerNotification::where('customer_id', $request->user()->id)
            ->where('id', $id)->delete();
        return response()->json(['status' => 'success']);
    }

    public function deleteBatchNotifications(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        CustomerNotification::where('customer_id', $request->user()->id)
            ->whereIn('id', $request->ids)->delete();
        return response()->json(['status' => 'success']);
    }

    public function deleteAllNotifications(Request $request)
    {
        CustomerNotification::where('customer_id', $request->user()->id)->delete();
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

        \Log::info('Submitting rating for delivery ID: ' . $id, [
            'rating' => $request->rating,
            'comment' => $request->comment,
            'rider_id' => $delivery->rider_id
        ]);

        $success = $delivery->update([
            'rating' => $request->rating,
            'rating_comment' => $request->comment,
            'rated_at' => now(),
        ]);

        \Log::info('Rating update result: ' . ($success ? 'Success' : 'Failed'));

        // Notify Rider
        if ($delivery->rider) {
            $delivery->rider->notify(new NewFeedbackReceived($delivery));
        }

        $customerId = $delivery->sale->customer_id ?? null;
        $riderId = $delivery->rider_id;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_riders'], 'delivery.rated'));
        if ($riderId)
            broadcast(new DataMutated("private-rider.{$riderId}", ['rider_dashboard', 'rider_notifications'], 'delivery.rated'));
        if ($customerId)
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders'], 'delivery.rated'));

        return response()->json([
            'data' => $delivery,
            'status' => 'success',
            'message' => 'Thank you for your feedback!',
        ]);
    }

    public function uploadProof(Request $request, $id)
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpeg,png,jpg,webp,heic,heif|max:10240|dimensions:max_width=4000,max_height=4000', // 10MB max, added heic/heif for iPhone
            'rider_latitude'  => 'nullable|numeric|between:-90,90',
            'rider_longitude' => 'nullable|numeric|between:-180,180',
        ]);

        $delivery = Delivery::with('sale.items.product')->findOrFail($id);

        // Verify rider owns this delivery
        if ($delivery->rider_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Handle HEIC/HEIF conversion to JPEG
        $file = $request->file('photo');
        $extension = strtolower($file->getClientOriginalExtension());
        
        if (in_array($extension, ['heic', 'heif'])) {
            // Convert HEIC to JPEG using ImageMagick if available
            try {
                $imageData = file_get_contents($file->getRealPath());
                $imagick = new \Imagick();
                $imagick->readImageBlob($imageData);
                $imagick->setImageFormat('jpeg');
                $imagick->setImageCompressionQuality(85);
                $jpegData = $imagick->getImageBlob();
                $imagick->destroy();
                
                // Store as JPEG
                $fileName = 'delivery-' . $id . '-' . time() . '.jpg';
                $path = 'delivery-proofs/' . $fileName;
                \Storage::disk('public')->put($path, $jpegData);
            } catch (\Exception $e) {
                // Fallback: store original HEIC if conversion fails
                $path = $file->store('delivery-proofs', 'public');
                \Log::warning('HEIC conversion failed, storing original: ' . $e->getMessage());
            }
        } else {
            // Store other formats directly
            $path = $file->store('delivery-proofs', 'public');
        }
        
        $photoUrl = asset('storage/' . $path);

        $delivery->update([
            'proof_photo' => $path,
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);

        if ($delivery->sale) {
            $delivery->sale->update(['status' => 'delivered']);
        }

        if ($delivery->rider_id) {
            RiderProfile::where('user_id', $delivery->rider_id)
                ->update(['availability' => 'available']);
        }

        // Notify customer that proof photo has been uploaded
        if ($delivery->sale && $delivery->sale->customer_id) {
            $productNames = $delivery->sale->items->map(function ($item) {
                $name = $item->product ? $item->product->name : 'Product';
                $variant = collect([
                    optional(optional($item->productVariant)->sizeValue)->label,
                    optional(optional($item->productVariant)->colorValue)->label,
                    optional(optional($item->productVariant)->weightValue)->label,
                ])->filter()->implode(' / ');
                $variantSuffix = $variant ? ' (' . $variant . ')' : '';
                return $item->quantity . 'x ' . $name . $variantSuffix;
            })->implode(', ');

            CustomerNotification::create([
                'customer_id' => $delivery->sale->customer_id,
                'delivery_id' => $delivery->id,
                'type' => 'delivered',
                'title' => 'Order Delivered successfully!',
                'message' => "Your order containing {$productNames} has arrived. Please tap View Proof.",
                'meta' => [
                    'proof_url' => $photoUrl,
                    'order_number' => $delivery->sale->order_number ?? null,
                ],
                'is_read' => false,
            ]);
        }

        // Wave 6 — geofence stamp + customer-confirm notification + payout-eligibility check.
        $this->stampGeofence($delivery->fresh(), $request->input('rider_latitude'), $request->input('rider_longitude'));
        $this->postCustomerConfirmationNotification($delivery->fresh());
        $this->maybePromoteToEligible($delivery->fresh());

        $riderId = $request->user()->id;
        $customerId = $delivery->sale ? $delivery->sale->customer_id : null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard', 'admin_orders'], 'delivery.proof_uploaded'));
        broadcast(new DataMutated("private-rider.{$riderId}", ['rider_dashboard'], 'delivery.proof_uploaded'));
        if ($customerId)
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.proof_uploaded'));

        return response()->json([
            'data' => [
                'photo_url' => $photoUrl,
                'status' => 'delivered'
            ],
            'status' => 'success',
            'message' => 'Delivery marked as complete and proof uploaded successfully',
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
        if ($delivery->sale && $delivery->sale->customer_id) {
            broadcast(new \App\Events\RiderLocationUpdated(
                $delivery->sale->customer_id,
                $delivery->rider_id,
                $request->latitude,
                $request->longitude,
                $request->heading ?? 0,
                $delivery->tracking_number
            ));
        }

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

    // ============================================================
    // Wave 6 — payout / anti-fraud helpers
    // ============================================================

    /**
     * POST /sales/{id}/customer-confirm-receipt — customer confirms they got the order.
     */
    public function customerConfirmReceipt(Request $request, $id)
    {
        $sale = \App\Models\Sale::with('delivery')->findOrFail($id);
        if ((int) $sale->customer_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if (!$sale->delivery) {
            return response()->json(['message' => 'No delivery to confirm'], 422);
        }
        if ($sale->delivery->customer_disputed_at) {
            return response()->json(['message' => 'Delivery is already disputed'], 422);
        }
        if (!$sale->delivery->customer_confirmed_at) {
            $sale->delivery->update(['customer_confirmed_at' => now()]);
        }
        $this->maybePromoteToEligible($sale->delivery->fresh());

        return response()->json(['status' => 'success']);
    }

    /**
     * POST /sales/{id}/customer-dispute-receipt — customer reports something wrong.
     */
    public function customerDisputeReceipt(Request $request, $id)
    {
        $request->validate(['reason' => 'required|string|max:500']);
        $sale = \App\Models\Sale::with('delivery')->findOrFail($id);
        if ((int) $sale->customer_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if (!$sale->delivery) {
            return response()->json(['message' => 'No delivery to dispute'], 422);
        }
        $sale->delivery->update([
            'customer_disputed_at'    => now(),
            'customer_dispute_reason' => $request->input('reason'),
            'payout_status'           => 'held',
        ]);

        return response()->json(['status' => 'success']);
    }

    /**
     * Promote a delivery from `pending` to `eligible` when all gating checks pass.
     * Public so other controllers (cash-remittance, customer confirm, sweep) can call it.
     */
    public function maybePromoteToEligible(\App\Models\Delivery $d): void
    {
        if (!$d) return;
        if ($d->payout_status === 'paid') return;
        if ($d->status !== 'delivered') return;
        if (empty($d->proof_photo)) return;
        if ($d->customer_disputed_at) { $d->update(['payout_status' => 'held']); return; }
        if ($d->geofence_flagged)     { $d->update(['payout_status' => 'held']); return; }

        $windowHours = (int) \App\Models\Setting::get('rider_customer_confirm_window_hours', 24);
        $customerOk = $d->customer_confirmed_at
            || ($d->delivered_at && $d->delivered_at->lt(now()->subHours($windowHours)));
        if (!$customerOk) return;

        $sale = $d->sale ?: optional($d->fresh(['sale']))->sale;
        $codOk = $sale && (strtolower((string) $sale->payment_method) !== 'cod' || $d->cash_remitted_at);
        if (!$codOk) return;

        $d->update([
            'payout_status'      => 'eligible',
            'payout_eligible_at' => now(),
        ]);
    }

    /**
     * Stamp rider GPS, distance to customer, and geofence flag on first delivered transition.
     */
    private function stampGeofence(\App\Models\Delivery $delivery, $riderLat, $riderLng): void
    {
        if (!is_null($delivery->mark_delivered_lat) || !is_null($delivery->mark_delivered_lng)) {
            return; // already stamped — write-once
        }
        if (is_null($riderLat) || is_null($riderLng)) {
            return; // rider didn't share GPS; admin can review the missing GPS in Payouts
        }

        $threshold = (int) \App\Models\Setting::get('rider_geofence_flag_radius_m', 50);

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
            $distanceM = $this->haversineMeters((float) $riderLat, (float) $riderLng, (float) $customerLat, (float) $customerLng);
            $update['geofence_distance_m'] = (int) round($distanceM);
            $update['geofence_flagged']    = $distanceM > $threshold;
        }

        $delivery->update($update);
    }

    private function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R = 6371000;
        $phi1 = deg2rad($lat1); $phi2 = deg2rad($lat2);
        $dPhi = deg2rad($lat2 - $lat1); $dLambda = deg2rad($lng2 - $lng1);
        $a = sin($dPhi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($dLambda / 2) ** 2;
        return 2 * $R * atan2(sqrt($a), sqrt(1 - $a));
    }

    /**
     * Post the "Did you receive your order?" customer notification on first delivered transition.
     */
    private function postCustomerConfirmationNotification(\App\Models\Delivery $delivery): void
    {
        if (!$delivery->sale || !$delivery->sale->customer_id) return;
        if ($delivery->customer_confirmed_at || $delivery->customer_disputed_at) return;

        // Avoid spamming if proof is uploaded multiple times — one row per delivery.
        $exists = CustomerNotification::where('delivery_id', $delivery->id)
            ->where('type', 'delivery_confirmation_request')
            ->exists();
        if ($exists) return;

        $windowHours = (int) \App\Models\Setting::get('rider_customer_confirm_window_hours', 24);

        CustomerNotification::create([
            'customer_id' => $delivery->sale->customer_id,
            'delivery_id' => $delivery->id,
            'type'        => 'delivery_confirmation_request',
            'title'       => 'Did you receive your order?',
            'message'     => 'Tap "Yes, I received it" to confirm. If something is wrong, tap "No". We will auto-confirm in ' . $windowHours . ' hours if there is no response.',
            'meta'        => [
                'requires_action' => true,
                'delivery_id'     => $delivery->id,
                'sale_id'         => $delivery->sale_id,
                'auto_confirm_at' => now()->addHours($windowHours)->toIso8601String(),
            ],
            'is_read'     => false,
        ]);
    }
}
