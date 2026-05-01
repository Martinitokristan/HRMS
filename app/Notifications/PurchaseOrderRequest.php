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
        $products = $this->po->items->map(function ($item) {
            $name = $item->supplierProduct ? $item->supplierProduct->name : ($item->product ? $item->product->name : 'Product');
            $qty = intval($item->quantity);
            return $qty . 'pcs ' . $name;
        })->implode(', ');

        return [
            'type' => 'purchase_order_request',
            'po_id' => $this->po->id,
            'po_number' => $this->po->po_number,
            'admin_id' => $this->po->created_by,
            'title' => 'New Stock Request',
            'message' => "HRMS has requested: {$products} (PO #{$this->po->po_number}). Please review and approve.",
        ];
    }
}
