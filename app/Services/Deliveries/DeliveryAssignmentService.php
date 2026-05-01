<?php

namespace App\Services\Deliveries;

use App\Events\DataMutated;
use App\Models\Delivery;
use App\Models\RiderProfile;
use App\Models\CustomerNotification;
use App\Notifications\NewOrderAssigned;
use Illuminate\Support\Facades\DB;

class DeliveryAssignmentService
{
    /**
     * Assign a rider to a delivery.
     */
    public function assign($deliveryId, $riderId, $user)
    {
        $delivery = Delivery::findOrFail($deliveryId);

        $delivery->update([
            'rider_id' => $riderId,
            'status' => 'pending',
        ]);

        // Notify Rider
        $delivery->rider->notify(new NewOrderAssigned($delivery));

        // Broadcasts
        $riderId = $riderId;
        $customerId = $delivery->sale->customer_id ?? null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard'], 'delivery.rider_assigned'));
        broadcast(new DataMutated("private-rider.{$riderId}", ['rider_dashboard', 'rider_notifications'], 'delivery.rider_assigned'));
        if ($customerId) {
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.rider_assigned'));
        }

        return $delivery->fresh()->load(['sale', 'rider']);
    }

    /**
     * Rider self-assigns a pending delivery.
     */
    public function selfAssign($deliveryId, $rider)
    {
        if ($rider->role !== 'rider') {
            return [
                'error' => 'Unauthorized - must be a rider',
                'status_code' => 403,
            ];
        }

        // Strictly scope the query to unassigned, pending deliveries to prevent IDOR
        $delivery = Delivery::where('status', 'pending')
            ->whereNull('rider_id')
            ->find($deliveryId);

        if (!$delivery) {
            return [
                'error' => 'Delivery not found or not available for assignment',
                'status_code' => 404,
            ];
        }

        DB::transaction(function () use ($delivery, $rider) {
            // Assign the rider
            $delivery->update([
                'rider_id' => $rider->id,
                'status' => 'confirmed', // Rider accepted
            ]);

            // Update sale status to confirmed
            $delivery->sale->update(['status' => 'confirmed']);
            $delivery->sale->refresh();
            $delivery->sale->markConfirmedOnce();

            // Bust cache
            \App\Support\ProductCache::bust();

            // Update rider availability
            RiderProfile::where('user_id', $rider->id)->update(['availability' => 'on_delivery']);

            // Notify customer that rider has been assigned
            CustomerNotification::create([
                'customer_id' => $delivery->sale->customer_id,
                'title' => 'Rider Assigned',
                'message' => "A rider has accepted your order #{$delivery->tracking_number} and is preparing for pickup.",
                'type' => 'rider_assigned'
            ]);
        });

        // Broadcasts
        $customerId = $delivery->sale->customer_id ?? null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard', 'admin_orders'], 'delivery.self_assigned'));
        broadcast(new DataMutated("private-rider.{$rider->id}", ['rider_dashboard'], 'delivery.self_assigned'));
        if ($customerId) {
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.self_assigned'));
        }

        return [
            'delivery' => $delivery->fresh()->load(['sale', 'rider']),
            'status_code' => 200,
        ];
    }

    /**
     * Rider declines an order.
     */
    public function decline($deliveryId, $rider, $note)
    {
        if ($rider->role !== 'rider') {
            return [
                'error' => 'Unauthorized - must be a rider',
                'status_code' => 403,
            ];
        }

        // Strictly scope the query to this rider's deliveries to prevent IDOR
        $delivery = Delivery::where('rider_id', $rider->id)
            ->whereIn('status', ['pending', 'assigned'])
            ->findOrFail($deliveryId);

        // Remove rider assignment and make available again
        $delivery->update([
            'rider_id' => null,
            'status' => 'pending',
            'notes' => ($delivery->notes ? $delivery->notes . "\n" : '') . "Declined by rider: {$note}"
        ]);

        // Update rider availability back to available
        RiderProfile::where('user_id', $rider->id)->update(['availability' => 'available']);

        // Notify customer about the decline
        CustomerNotification::create([
            'customer_id' => $delivery->sale->customer_id,
            'title' => 'Rider Declined Order',
            'message' => "The assigned rider declined your order #{$delivery->tracking_number}. Reason: {$note}",
            'type' => 'rider_declined'
        ]);

        // Broadcasts
        $customerId = $delivery->sale->customer_id ?? null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard'], 'delivery.declined'));
        broadcast(new DataMutated("private-rider.{$rider->id}", ['rider_dashboard'], 'delivery.declined'));
        if ($customerId) {
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.declined'));
        }

        return ['status_code' => 200];
    }

    /**
     * Destroy a pending delivery.
     */
    public function delete($deliveryId)
    {
        $delivery = Delivery::findOrFail($deliveryId);
        if ($delivery->status !== 'pending') {
            return [
                'error' => 'Only pending deliveries can be deleted.',
                'status_code' => 422,
            ];
        }
        $delivery->delete();
        return ['status_code' => 200];
    }
}
