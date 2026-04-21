<?php

namespace App\Notifications;

use App\Models\Inventory;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class StockAlert extends Notification implements \Illuminate\Contracts\Queue\ShouldQueue
{
    use Queueable;

    protected string $alertType; // 'low_stock' or 'out_of_stock'
    protected string $productName;
    protected int $currentStock;
    protected int $reorderThreshold;

    public function __construct(string $alertType, string $productName, int $currentStock, int $reorderThreshold)
    {
        $this->alertType = $alertType;
        $this->productName = $productName;
        $this->currentStock = $currentStock;
        $this->reorderThreshold = $reorderThreshold;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toDatabase($notifiable)
    {
        if ($this->alertType === 'out_of_stock') {
            return [
                'type'    => 'out_of_stock',
                'title'   => '🚨 Out of Stock',
                'message' => "{$this->productName} is now out of stock (0 units remaining).",
                'product_name'      => $this->productName,
                'current_stock'     => $this->currentStock,
                'reorder_threshold' => $this->reorderThreshold,
            ];
        }

        return [
            'type'    => 'low_stock',
            'title'   => '⚠️ Low Stock Alert',
            'message' => "{$this->productName} is running low — {$this->currentStock} unit(s) left (threshold: {$this->reorderThreshold}).",
            'product_name'      => $this->productName,
            'current_stock'     => $this->currentStock,
            'reorder_threshold' => $this->reorderThreshold,
        ];
    }
}
