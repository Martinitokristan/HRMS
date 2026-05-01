<?php

namespace App\Services\Inventory;

use App\Events\DataMutated;
use App\Jobs\ProcessProductBannerImage;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\InventoryAdjustment;
use App\Models\SupplierProductVariant;
use App\Models\Variant;
use App\Models\VariantValue;
use App\Models\UnitType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Cache\TaggableStore;

class InventoryTransferService
{
    /**
     * Transfer stock from warehouse to storefront for a single inventory.
     */
    public function transferToStore($data, $user)
    {
        try {
            $result = DB::transaction(function () use ($data, $user) {
                $inv = null;

                if (isset($data['inventory_id'])) {
                    // Check if it's a supplier product variant ID (prefixed with 'spv-')
                    if (strpos($data['inventory_id'], 'spv-') === 0) {
                        $supplierVariantId = (int) substr($data['inventory_id'], 4);
                        $spVariant = SupplierProductVariant::findOrFail($supplierVariantId);
                        $inv = Inventory::where('supplier_product_variant_id', $supplierVariantId)->first();

                        if (!$inv) {
                            $inv = Inventory::create([
                                'supplier_product_id' => $spVariant->supplier_product_id,
                                'supplier_product_variant_id' => $supplierVariantId,
                                'current_stock' => 0,
                                'warehouse_stock' => $spVariant->stock ?? 0,
                                'reorder_threshold' => 10,
                            ]);
                        }
                    } else {
                        $inv = Inventory::findOrFail($data['inventory_id']);
                    }
                } else {
                    $inv = Inventory::where('product_id', $data['product_id'])
                        ->where('product_variant_id', $data['variant_id'] ?? null)
                        ->firstOrFail();
                }

                if ($inv->warehouse_stock < $data['quantity']) {
                    abort(422, 'Insufficient warehouse stock for transfer.');
                }

                // Logic for "Orphan" items (Supplier Product not yet in Store)
                if (!$inv->product_id && $inv->supplier_product_id) {
                    $existingInv = Inventory::where('supplier_product_id', $inv->supplier_product_id)
                        ->whereNotNull('product_id')->first();
                    $sp = $inv->supplierProduct;
                    $pd = $data['product_data'] ?? [];

                    if ($existingInv) {
                        $productId = $existingInv->product_id;
                    } else {
                        // Create product from supplier product
                        $unitTypeId = 1;
                        if (!empty($pd['unit_type_id'])) {
                            $unitTypeId = $pd['unit_type_id'];
                        } elseif (UnitType::count() > 0) {
                            $unitTypeId = UnitType::first()->id;
                        }

                        $product = Product::create([
                            'name' => !empty($pd['name']) ? $pd['name'] : $sp->name,
                            'barcode' => !empty($pd['barcode']) ? $pd['barcode'] : ($sp->barcode ?? $this->generateUniqueBarcode()),
                            'description' => !empty($pd['description']) ? $pd['description'] : $sp->description,
                            'category_id' => !empty($pd['category_id']) ? $pd['category_id'] : $sp->category_id,
                            'supplier_id' => $sp->supplier_id,
                            'unit_type_id' => $unitTypeId,
                            'purchase_price' => !empty($pd['purchase_price']) ? $pd['purchase_price'] : $sp->price,
                            'sell_price' => !empty($pd['sell_price']) ? $pd['sell_price'] : ($sp->price * 1.3),
                            'image_path' => $sp->image_path,
                            'is_active' => true,
                        ]);
                        $productId = $product->id;

                        if (!empty($product->image_path)) {
                            ProcessProductBannerImage::dispatch($product->id, $product->image_path);
                        }
                    }

                    // Link inventory to new product and map variants
                    $inv->product_id = $productId;
                    $this->mapProductVariant($inv, $pd);
                    $inv->save();
                } else {
                    $productId = $inv->product_id;

                    // Update existing product with admin's pricing and details
                    if (!empty($data['product_data'])) {
                        $pd = $data['product_data'];
                        $product = Product::find($productId);
                        if ($product) {
                            $updateData = [];
                            if (!empty($pd['name']))
                                $updateData['name'] = $pd['name'];
                            if (!empty($pd['barcode']))
                                $updateData['barcode'] = $pd['barcode'];
                            if (!empty($pd['description']))
                                $updateData['description'] = $pd['description'];
                            if (!empty($pd['category_id']))
                                $updateData['category_id'] = $pd['category_id'];
                            if (!empty($pd['sell_price']))
                                $updateData['sell_price'] = $pd['sell_price'];

                            $updateData['is_active'] = true;

                            if (count($updateData) > 0) {
                                $product->update($updateData);
                            }
                        }
                    }

                    // Handle supplier variant creation for non-orphan items
                    if (!$inv->product_variant_id && $inv->supplier_product_variant_id) {
                        $this->mapProductVariant($inv, $data['product_data'] ?? []);
                    }
                }

                // Deduct from warehouse
                $inv->decrement('warehouse_stock', $data['quantity']);
                $inv->refresh();

                // Add to storefront
                if ($inv->product_variant_id) {
                    $variant = ProductVariant::findOrFail($inv->product_variant_id);
                    $variant->increment('stock', $data['quantity']);
                    $inv->increment('current_stock', $data['quantity']);
                } else {
                    $baseInventory = Inventory::where('product_id', $productId)
                        ->whereNull('product_variant_id')
                        ->first();

                    if (!$baseInventory) {
                        $baseInventory = Inventory::create([
                            'product_id' => $productId,
                            'product_variant_id' => null,
                            'supplier_product_id' => $inv->supplier_product_id,
                            'current_stock' => 0,
                            'warehouse_stock' => 0,
                            'reorder_threshold' => 10,
                        ]);
                    }

                    $baseInventory->increment('current_stock', $data['quantity']);
                }

                InventoryAdjustment::create([
                    'product_id' => $productId,
                    'user_id' => $user->id,
                    'type' => 'add',
                    'quantity' => $data['quantity'],
                    'note' => 'Transferred from Warehouse to Storefront',
                    'created_at' => now(),
                ]);

                return $inv->load('product');
            });

            if (Cache::getStore() instanceof TaggableStore) {
                Cache::tags(['inventory', 'products'])->flush();
            } else {
                Cache::increment('inventory:version');
                \App\Support\ProductCache::bust();
            }
            broadcast(new DataMutated('private-admin', ['admin_inventory'], 'inventory.transferred'));
            broadcast(new DataMutated('shop', ['customer_shop'], 'inventory.transferred'));

            return [
                'result' => $result,
                'status_code' => 200,
            ];
        } catch (\Exception $e) {
            Log::error('transferToStore exception', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return [
                'error' => $e->getMessage(),
                'status_code' => 422,
            ];
        }
    }

    /**
     * Transfer multiple inventory items to storefront.
     */
    public function transferMultipleToStore($data, $user)
    {
        try {
            $results = DB::transaction(function () use ($data, $user) {
                $transferredCount = 0;
                $productId = null;
                $baseProductData = $data['base_product_data'] ?? [];

                foreach ($data['transfers'] as $transfer) {
                    // Handle supplier product variant IDs
                    if (strpos($transfer['inventory_id'], 'spv-') === 0) {
                        $supplierVariantId = (int) substr($transfer['inventory_id'], 4);
                        $spVariant = SupplierProductVariant::findOrFail($supplierVariantId);
                        $inv = Inventory::where('supplier_product_variant_id', $supplierVariantId)->first();

                        if (!$inv) {
                            $inv = Inventory::create([
                                'supplier_product_id' => $spVariant->supplier_product_id,
                                'supplier_product_variant_id' => $supplierVariantId,
                                'current_stock' => 0,
                                'warehouse_stock' => $spVariant->stock ?? 0,
                                'reorder_threshold' => 10,
                            ]);
                        }
                    } else {
                        $inv = Inventory::findOrFail($transfer['inventory_id']);
                    }

                    if ($inv->warehouse_stock < $transfer['quantity']) {
                        abort(422, "Insufficient warehouse stock for variant (ID: {$inv->id})");
                    }

                    // For first variant, create/update the base product
                    if ($productId === null) {
                        if (!$inv->product_id && $inv->supplier_product_id) {
                            $existingInv = Inventory::where('supplier_product_id', $inv->supplier_product_id)
                                ->whereNotNull('product_id')->first();

                            if ($existingInv) {
                                $productId = $existingInv->product_id;
                            } else {
                                // Create product from supplier product
                                $sp = $inv->supplierProduct;

                                $unitTypeId = 1;
                                if (!empty($baseProductData['unit_type_id'])) {
                                    $unitTypeId = $baseProductData['unit_type_id'];
                                } elseif (UnitType::count() > 0) {
                                    $unitTypeId = UnitType::first()->id;
                                }

                                $product = Product::create([
                                    'name' => !empty($baseProductData['name']) ? $baseProductData['name'] : $sp->name,
                                    'barcode' => !empty($baseProductData['barcode']) ? $baseProductData['barcode'] : $sp->barcode,
                                    'description' => !empty($baseProductData['description']) ? $baseProductData['description'] : $sp->description,
                                    'category_id' => !empty($baseProductData['category_id']) ? $baseProductData['category_id'] : $sp->category_id,
                                    'supplier_id' => $sp->supplier_id,
                                    'unit_type_id' => $unitTypeId,
                                    'purchase_price' => !empty($baseProductData['purchase_price']) ? $baseProductData['purchase_price'] : $sp->price,
                                    'sell_price' => !empty($baseProductData['sell_price']) ? $baseProductData['sell_price'] : ($sp->price * 1.3),
                                    'image_path' => $sp->image_path,
                                    'is_active' => true,
                                ]);

                                $productId = $product->id;

                                if (!empty($product->image_path)) {
                                    ProcessProductBannerImage::dispatch($product->id, $product->image_path);
                                }
                            }
                        } else {
                            $productId = $inv->product_id;
                        }
                    }

                    // Link inventory to product if not already linked
                    if (!$inv->product_id) {
                        $inv->product_id = $productId;
                        $this->mapProductVariant($inv, $transfer['product_data'] ?? []);
                        $inv->save();
                    }

                    // Deduct from warehouse
                    $inv->decrement('warehouse_stock', $transfer['quantity']);

                    // Add to storefront with variant-specific pricing
                    if ($inv->product_variant_id) {
                        $variant = ProductVariant::findOrFail($inv->product_variant_id);
                        $variant->increment('stock', $transfer['quantity']);

                        if (!empty($transfer['product_data']['sell_price'])) {
                            $variant->update(['price_override' => $transfer['product_data']['sell_price']]);
                        }

                        $inv->increment('current_stock', $transfer['quantity']);
                    } else {
                        $inv->increment('current_stock', $transfer['quantity']);
                    }

                    InventoryAdjustment::create([
                        'product_id' => $productId,
                        'user_id' => $user->id,
                        'type' => 'add',
                        'quantity' => $transfer['quantity'],
                        'note' => 'Multi-variant transfer from Warehouse to Storefront',
                        'created_at' => now(),
                    ]);

                    $transferredCount++;
                }

                return [
                    'count' => $transferredCount,
                    'product_id' => $productId,
                ];
            });

            if (Cache::getStore() instanceof TaggableStore) {
                Cache::tags(['inventory', 'products'])->flush();
            } else {
                Cache::increment('inventory:version');
                \App\Support\ProductCache::bust();
            }
            broadcast(new DataMutated('private-admin', ['admin_inventory'], 'inventory.transferred_multiple'));
            broadcast(new DataMutated('shop', ['customer_shop'], 'inventory.transferred_multiple'));

            return [
                'results' => $results,
                'status_code' => 200,
            ];
        } catch (\Exception $e) {
            Log::error('transferMultipleToStore exception', ['message' => $e->getMessage()]);
            return [
                'error' => $e->getMessage(),
                'status_code' => 422,
            ];
        }
    }

    /**
     * Map supplier product variant to product variant.
     */
    private function mapProductVariant($inv, $productData = [])
    {
        if (!$inv->supplier_product_variant_id) {
            return;
        }

        $spVariant = SupplierProductVariant::find($inv->supplier_product_variant_id);
        if (!$spVariant) {
            return;
        }

        $sizeValueId = $spVariant->size ? VariantValue::firstOrCreate(
            ['variant_id' => Variant::firstOrCreate(['name' => 'Size'], ['status' => 1])->id, 'label' => $spVariant->size]
        )->id : null;

        $colorValueId = $spVariant->color ? VariantValue::firstOrCreate(
            ['variant_id' => Variant::firstOrCreate(['name' => 'Color'], ['status' => 1])->id, 'label' => $spVariant->color]
        )->id : null;

        $weightValueId = $spVariant->weight ? VariantValue::firstOrCreate(
            ['variant_id' => Variant::firstOrCreate(['name' => 'Weight'], ['status' => 1])->id, 'label' => $spVariant->weight]
        )->id : null;

        $priceOverride = !empty($productData['sell_price']) ? $productData['sell_price'] : ($spVariant->price_override ? $spVariant->price_override * 1.3 : null);

        $existingVariant = ProductVariant::where('product_id', $inv->product_id)
            ->where('size_value_id', $sizeValueId)
            ->where('color_value_id', $colorValueId)
            ->where('weight_value_id', $weightValueId)
            ->first();

        if ($existingVariant) {
            $inv->product_variant_id = $existingVariant->id;
        } else {
            $newVariant = ProductVariant::create([
                'product_id' => $inv->product_id,
                'size_value_id' => $sizeValueId,
                'color_value_id' => $colorValueId,
                'weight_value_id' => $weightValueId,
                'stock' => 0,
                'price_override' => $priceOverride,
                'barcode' => $spVariant->barcode ?: null,
                'image_path' => $spVariant->image_path,
                'additional_images' => $spVariant->additional_images,
            ]);
            $inv->product_variant_id = $newVariant->id;
        }
    }

    /**
     * Generate a unique barcode.
     */
    private function generateUniqueBarcode($prefix = 'BARCODE-')
    {
        $maxId = Product::max('id') ?? 0;
        $baseNumber = $maxId + 1;

        do {
            $barcode = $prefix . str_pad($baseNumber, 6, '0', STR_PAD_LEFT);
            $exists = Product::where('barcode', $barcode)->exists();
            if ($exists) {
                $baseNumber++;
            }
        } while ($exists);

        return $barcode;
    }
}
