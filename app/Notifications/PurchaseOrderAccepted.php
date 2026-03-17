<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PurchaseOrderAccepted extends Notification
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
            'type' => 'purchase_order_accepted',
            'po_id' => $this->po->id,
            'po_number' => $this->po->po_number,
            'supplier_name' => $this->po->supplier->name ?? 'Supplier',
            'title' => 'Purchase Order Accepted',
            'message' => "Your stock request (PO #{$this->po->po_number}) has been accepted. Inventory has been updated automatically.",
        ];
    }
}
