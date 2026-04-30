<?php

namespace App\Services\Inventory;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\POItem;
use Illuminate\Support\Facades\DB;

class InventoryReorderService
{
    /**
     * Create a reorder purchase order for a product.
     */
    public function reorder($productId, $user)
    {
        $product = Product::with(['supplier'])->findOrFail($productId);
        $inventory = Inventory::where('product_id', $productId)->firstOrFail();

        if (!$product->supplier_id) {
            return [
                'error' => 'Product has no supplier assigned.',
                'status_code' => 422,
            ];
        }

        $reorderQty = $inventory->reorder_threshold * 2;
        $po = DB::transaction(function () use ($product, $reorderQty, $user) {
            $po = PurchaseOrder::create([
                'po_number' => 'PO-' . str_pad(PurchaseOrder::count() + 1, 4, '0', STR_PAD_LEFT),
                'supplier_id' => $product->supplier_id,
                'created_by' => $user->id,
                'is_auto' => true,
                'status' => 'draft',
                'total_cost' => $reorderQty * $product->purchase_price,
            ]);

            POItem::create([
                'purchase_order_id' => $po->id,
                'product_id' => $product->id,
                'quantity' => $reorderQty,
                'unit_cost' => $product->purchase_price,
                'subtotal' => $reorderQty * $product->purchase_price,
            ]);

            return $po;
        });

        return [
            'po' => $po->load(['supplier', 'items.product']),
            'status_code' => 201,
        ];
    }
}
