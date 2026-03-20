<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RiderLocationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $customerId;
    public $riderId;
    public $latitude;
    public $longitude;
    public $trackingNumber;

    public function __construct($customerId, $riderId, $latitude, $longitude, $trackingNumber)
    {
        $this->customerId = $customerId;
        $this->riderId = $riderId;
        $this->latitude = $latitude;
        $this->longitude = $longitude;
        $this->trackingNumber = $trackingNumber;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('customer.' . $this->customerId);
    }

    public function broadcastAs()
    {
        return 'rider.location.updated';
    }

    public function broadcastWith()
    {
        return [
            'rider_id' => $this->riderId,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'tracking_number' => $this->trackingNumber,
            'timestamp' => now()->toISOString()
        ];
    }
}
