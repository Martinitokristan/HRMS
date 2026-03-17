<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PurchaseOrderRequest extends Notification
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
            'type' => 'purchase_order_request',
            'po_id' => $this->po->id,
            'po_number' => $this->po->po_number,
            'admin_id' => $this->po->created_by,
            'title' => 'New Stock Request Received',
            'message' => "An admin has requested stock from you (PO #{$this->po->po_number}). Please review and approve.",
        ];
    }
}
