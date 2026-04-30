<?php

namespace App\Services\Deliveries;

use App\Models\Delivery;
use App\Models\CustomerNotification;

class DeliveryPauseService
{
    /**
     * Pause an in-progress delivery.
     */
    public function pause($delivery, $user, $reason, $resumesAt = null)
    {
        if ($delivery->rider_id !== $user->id) {
            return [
                'error' => 'Unauthorized',
                'status_code' => 403,
            ];
        }

        if ($delivery->status !== 'in_progress') {
            return [
                'error' => 'Only in-progress deliveries can be paused',
                'status_code' => 422,
            ];
        }

        if (!is_null($delivery->paused_at)) {
            return [
                'error' => 'Delivery is already paused',
                'status_code' => 422,
            ];
        }

        $delivery->paused_at = now();
        $delivery->pause_reason = $reason;
        $delivery->pause_resumes_at = $resumesAt ?: now()->addDay()->startOfDay()->addHours(8);
        $delivery->save();

        if ($delivery->sale && $delivery->sale->customer_id) {
            CustomerNotification::create([
                'customer_id' => $delivery->sale->customer_id,
                'type' => 'delivery_paused',
                'title' => 'Your delivery has been paused',
                'message' => 'Your delivery is paused. Reason: ' . $delivery->pause_reason
                    . '. Expected resume: ' . optional($delivery->pause_resumes_at)->format('M j, g:i A') . '.',
                'meta' => json_encode([
                    'delivery_id' => $delivery->id,
                    'order_number' => optional($delivery->sale)->order_number,
                    'pause_reason' => $delivery->pause_reason,
                    'pause_resumes_at' => optional($delivery->pause_resumes_at)->toIso8601String(),
                ]),
            ]);
        }

        return [
            'data' => $delivery,
            'status_code' => 200,
        ];
    }

    /**
     * Resume a paused delivery.
     */
    public function resume($delivery, $user)
    {
        if ($delivery->rider_id !== $user->id) {
            return [
                'error' => 'Unauthorized',
                'status_code' => 403,
            ];
        }

        if (is_null($delivery->paused_at)) {
            return [
                'error' => 'Delivery is not paused',
                'status_code' => 422,
            ];
        }

        $delivery->paused_at = null;
        $delivery->pause_reason = null;
        $delivery->pause_resumes_at = null;
        $delivery->save();

        if ($delivery->sale && $delivery->sale->customer_id) {
            CustomerNotification::create([
                'customer_id' => $delivery->sale->customer_id,
                'type' => 'delivery_resumed',
                'title' => 'Your delivery has resumed',
                'message' => 'Your rider has resumed your delivery and is on the way.',
                'meta' => json_encode([
                    'delivery_id' => $delivery->id,
                    'order_number' => optional($delivery->sale)->order_number,
                ]),
            ]);
        }

        return [
            'data' => $delivery,
            'status_code' => 200,
        ];
    }
}
