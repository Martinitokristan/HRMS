<?php

namespace App\Notifications;

use App\Models\Sale;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class GCashPaymentReceived extends Notification
{
    use Queueable;

    protected $sale;
    protected $smsBody;
    protected $amount;
    protected $phone;

    public function __construct(Sale $sale, $smsBody, $amount, $phone = null)
    {
        $this->sale = $sale;
        $this->smsBody = $smsBody;
        $this->amount = $amount;
        $this->phone = $phone;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toDatabase($notifiable)
    {
        // Clean SMS body — strip doubled title prefix
        $cleanBody = $this->smsBody;
        $pos = strpos($cleanBody, 'You have received PHP');
        if ($pos !== false && $pos > 0) {
            $cleanBody = substr($cleanBody, $pos);
        }

        // Load items for the toast display
        $this->sale->loadMissing('items.product');
        $items = $this->sale->items->map(fn($i) => [
            'name'     => $i->product->name ?? 'Item',
            'quantity' => $i->quantity,
        ])->values()->toArray();

        return [
            'type' => 'gcash_payment',
            'title' => '💰 GCash Payment Received!',
            'message' => $cleanBody,
            'amount' => $this->amount,
            'phone' => $this->phone,
            'order_number' => $this->sale->order_number,
            'sale_id' => $this->sale->id,
            'customer_name' => $this->sale->customer->name ?? 'Unknown',
            'items' => $items,
        ];
    }
}
