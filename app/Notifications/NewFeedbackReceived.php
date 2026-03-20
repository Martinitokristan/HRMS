<?php

namespace App\Notifications;

use App\Models\Delivery;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewFeedbackReceived extends Notification
{
    use Queueable;

    protected $delivery;

    public function __construct(Delivery $delivery)
    {
        $this->delivery = $delivery;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toArray($notifiable)
    {
        return [
            'type' => 'feedback',
            'delivery_id' => $this->delivery->id,
            'rating' => $this->delivery->rating,
            'comment' => $this->delivery->rating_comment,
            'title' => '⭐️ New Feedback Received',
            'message' => "A customer rated your delivery: {$this->delivery->rating}/5 stars.",
        ];
    }
}
