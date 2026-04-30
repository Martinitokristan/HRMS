<?php

namespace App\Services\Deliveries;

use App\Events\DataMutated;
use App\Models\Delivery;
use App\Notifications\NewFeedbackReceived;

class DeliveryRatingService
{
    /**
     * Submit rating for a delivered order.
     */
    public function submitRating($delivery, $user, $rating, $comment = null)
    {
        // Verify customer owns this delivery
        if ($delivery->sale->customer_id !== $user->id) {
            return [
                'error' => 'Unauthorized',
                'status_code' => 403,
            ];
        }

        // Only allow rating if delivered
        if ($delivery->status !== 'delivered') {
            return [
                'error' => 'Can only rate delivered orders',
                'status_code' => 400,
            ];
        }

        \Log::info('Submitting rating for delivery ID: ' . $delivery->id, [
            'rating' => $rating,
            'comment' => $comment,
            'rider_id' => $delivery->rider_id
        ]);

        $success = $delivery->update([
            'rating' => $rating,
            'rating_comment' => $comment,
            'rated_at' => now(),
        ]);

        \Log::info('Rating update result: ' . ($success ? 'Success' : 'Failed'));

        // Notify Rider
        if ($delivery->rider) {
            $delivery->rider->notify(new NewFeedbackReceived($delivery));
        }

        // Broadcasts
        $customerId = $delivery->sale->customer_id ?? null;
        $riderId = $delivery->rider_id;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_riders'], 'delivery.rated'));
        if ($riderId) {
            broadcast(new DataMutated("private-rider.{$riderId}", ['rider_dashboard', 'rider_notifications'], 'delivery.rated'));
        }
        if ($customerId) {
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders'], 'delivery.rated'));
        }

        return [
            'data' => $delivery,
            'status_code' => 200,
        ];
    }
}
