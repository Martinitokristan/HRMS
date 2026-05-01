<?php

namespace App\Services\Inventory;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\InventoryAdjustment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Cache\TaggableStore;

class InventoryAdjustmentService
{
    /**
     * Adjust stock for a product or variant.
     */
    public function adjust($data, $user)
    {
        $inventory = null;

        DB::transaction(function () use ($data, $user, &$inventory) {
            if ($data['variant_id']) {
                $variant = ProductVariant::findOrFail($data['variant_id']);
                if ($data['type'] === 'add') {
                    $variant->increment('stock', $data['quantity']);
                } elseif ($data['type'] === 'subtract') {
                    $variant->decrement('stock', $data['quantity']);
                } else {
                    $variant->update(['stock' => $data['quantity']]);
                }
            } else {
                $product = Product::findOrFail($data['product_id']);
                $inventory = Inventory::where('product_id', $product->id)->firstOrFail();
                if ($data['type'] === 'add') {
                    $inventory->increment('current_stock', $data['quantity']);
                } elseif ($data['type'] === 'subtract') {
                    $inventory->decrement('current_stock', $data['quantity']);
                } else {
                    $inventory->update(['current_stock' => $data['quantity']]);
                }
                $inventory->last_adjusted_at = now();
                $inventory->save();
            }

            InventoryAdjustment::create([
                'product_id' => $data['product_id'],
                'user_id' => $user->id,
                'type' => $data['type'],
                'quantity' => $data['quantity'],
                'note' => $data['reason'] ?? null,
                'created_at' => now(),
            ]);
        });

        if (Cache::getStore() instanceof TaggableStore) {
            Cache::tags(['inventory'])->flush();
        }

        return [
            'status_code' => 200,
            'message' => 'Stock adjusted successfully',
            'inventory' => $inventory,
        ];
    }
}
