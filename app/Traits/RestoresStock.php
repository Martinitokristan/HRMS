<?php

namespace App\Traits;

use App\Models\Inventory;
use App\Models\Sale;

trait RestoresStock
{
    protected function restoreStock(Sale $sale): void
    {
        $sale->loadMissing('items');

        foreach ($sale->items as $item) {
            if ($item->product_variant_id) {
                $variant = \App\Models\ProductVariant::find($item->product_variant_id);
                if ($variant) {
                    $variant->increment('stock', $item->quantity);
                }

                $variantInventory = Inventory::where('product_id', $item->product_id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->first();

                if ($variantInventory) {
                    $variantInventory->increment('current_stock', $item->quantity);
                }
            } else {
                $inv = Inventory::where('product_id', $item->product_id)
                    ->whereNull('product_variant_id')
                    ->first();

                if ($inv) {
                    $inv->increment('current_stock', $item->quantity);
                }
            }
        }
    }

    /**
     * Restore stock for return payload items.
     *
     * Expected item shape:
     * - product_id (int)
     * - product_variant_id (int|null)
     * - quantity (int)
     */
    protected function restoreStockFromReturnItems(array $items): void
    {
        foreach ($items as $item) {
            $qty = (int) ($item['quantity'] ?? 0);
            if ($qty <= 0) {
                continue;
            }

            $productId = $item['product_id'] ?? null;
            $variantId = $item['product_variant_id'] ?? null;

            if (!empty($variantId)) {
                $variant = \App\Models\ProductVariant::find($variantId);
                if ($variant) {
                    $variant->increment('stock', $qty);
                }

                $variantInventory = Inventory::where('product_id', $productId)
                    ->where('product_variant_id', $variantId)
                    ->first();

                if ($variantInventory) {
                    $variantInventory->increment('current_stock', $qty);
                }
            } else {
                $inv = Inventory::where('product_id', $productId)
                    ->whereNull('product_variant_id')
                    ->first();

                if ($inv) {
                    $inv->increment('current_stock', $qty);
                }
            }
        }
    }
}

