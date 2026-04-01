<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DataMutated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $channel;
    public array  $staleKeys;
    public string $eventType;

    public function __construct(string $channel, array $staleKeys, string $eventType)
    {
        $this->channel   = $channel;
        $this->staleKeys = $staleKeys;
        $this->eventType = $eventType;
    }

    public function broadcastOn(): array
    {
        if (strpos($this->channel, 'private-') === 0) {
            return [new PrivateChannel(substr($this->channel, 8))];
        }

        return [new Channel($this->channel)];
    }

    public function broadcastAs(): string
    {
        return 'data.mutated';
    }

    public function broadcastWith(): array
    {
        return [
            'stale_keys' => $this->staleKeys,
            'event_type' => $this->eventType,
        ];
    }
}
