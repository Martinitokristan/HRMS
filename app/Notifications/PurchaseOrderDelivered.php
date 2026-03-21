<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PurchaseOrderDelivered extends Notification
{
    use Queueable;

    protected $po;

    public function __construct(PurchaseOrder $po)
    {
        $this->po = $po;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toArray($notifiable)
    {
        return [
            'type' => 'purchase_order_delivered',
            'po_id' => $this->po->id,
            'po_number' => $this->po->po_number,
            'supplier_name' => $this->po->supplier->name ?? 'Supplier',
            'title' => 'Purchase Order Delivered',
            'message' => "The items for PO #{$this->po->po_number} have been delivered. Please review and mark as received.",
        ];
    }
}
