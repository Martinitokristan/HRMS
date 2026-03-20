<?php

namespace App\Notifications;

use App\Models\Delivery;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewOrderAssigned extends Notification
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
        $orderNumber = $this->delivery->sale->order_number ?? $this->delivery->sale_id;
        return [
            'type' => 'new_order',
            'delivery_id' => $this->delivery->id,
            'sale_id' => $this->delivery->sale_id,
            'order_number' => $orderNumber,
            'customer_name' => $this->delivery->sale->customer->name ?? 'Customer',
            'customer_address' => $this->delivery->address,
            'title' => 'New Order Assigned',
            'message' => "You have been assigned a new delivery for Order #{$orderNumber}.",
        ];
    }
}
