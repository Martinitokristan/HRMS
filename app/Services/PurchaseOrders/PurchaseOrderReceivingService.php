<?php

namespace App\Services\PurchaseOrders;

use App\Models\PurchaseOrder;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SupplierProduct;
use App\Models\SupplierProductVariant;
use App\Models\InventoryAdjustment;
use App\Jobs\ProcessProductBannerImage;
use App\Events\DataMutated;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PurchaseOrderReceivingService
{
    /**
     * Mark purchase order as received.
     */
    public function markReceived($id)
    {
        try {
            $po = PurchaseOrder::with('items')->findOrFail($id);

            if ($po->status !== 'supplier_delivered') {
                return [
                    'error' => 'Only delivered POs can be marked as received.',
                    'status_code' => 422,
                ];
            }

            // Pre-fetch data to minimize DB queries
            $supplierProductIds = $po->items->pluck('supplier_product_id')->filter()->unique()->toArray();
            $supplierVariantIds = $po->items->pluck('supplier_product_variant_id')->filter()->unique()->toArray();
            $existingSupplierProducts = SupplierProduct::whereIn('id', $supplierProductIds)->get()->keyBy('id');
            $existingSupplierVariants = SupplierProductVariant::whereIn('id', $supplierVariantIds)->get()->keyBy('id');

            $generateUniqueBarcode = function ($prefix = 'BARCODE-') {
                return $prefix . strtoupper(\Illuminate\Support\Str::random(10));
            };

            $po = DB::transaction(function () use ($id, $po, $existingSupplierProducts, $existingSupplierVariants, $generateUniqueBarcode) {
                $po = PurchaseOrder::with('items')->where('id', $id)->lockForUpdate()->firstOrFail();

                if ($po->status !== 'supplier_delivered') {
                    throw new \Exception('Only delivered POs can be marked as received.', 422);
                }

                static $productLocalCache = [];

                foreach ($po->items as $item) {
                    $inv = null;
                    $supplierProductId = $item->supplier_product_id;

                    if (is_null($item->product_variant_id) && is_null($item->supplier_product_variant_id)) {
                        $inv = Inventory::where('product_id', $item->product_id)
                            ->whereNull('product_variant_id')
                            ->lockForUpdate()
                            ->first();
                    } else {
                        if (!is_null($item->product_variant_id)) {
                            $inv = Inventory::where('product_id', $item->product_id)
                                ->where('product_variant_id', $item->product_variant_id)
                                ->lockForUpdate()
                                ->first();
                        }

                        if (!$inv && !is_null($item->supplier_product_variant_id)) {
                            $inv = Inventory::where('supplier_product_variant_id', $item->supplier_product_variant_id)
                                ->lockForUpdate()
                                ->first();
                        }
                    }

                    if (!$inv || (is_null($inv->product_id) && $item->supplier_product_id)) {
                        $productId = $item->product_id ?: (isset($productLocalCache[$supplierProductId]) ? $productLocalCache[$supplierProductId] : null);
                        $variantId = $item->product_variant_id;

                        if (!$productId && $item->supplier_product_id) {
                            $supplierProduct = $existingSupplierProducts->get($item->supplier_product_id);

                            if ($supplierProduct) {
                                $newProduct = Product::firstOrCreate(
                                    ['name' => $supplierProduct->name, 'supplier_id' => $supplierProduct->supplier_id ?? 1],
                                    [
                                        'barcode' => !empty($supplierProduct->barcode) && $supplierProduct->barcode !== 'undefined' ? $supplierProduct->barcode : $generateUniqueBarcode(),
                                        'description' => $supplierProduct->description,
                                        'category_id' => $supplierProduct->category_id,
                                        'brand_id' => $supplierProduct->brand_id,
                                        'unit_type_id' => 1,
                                        'purchase_price' => $supplierProduct->price,
                                        'sell_price' => $supplierProduct->price * 1.3,
                                        'image_path' => $supplierProduct->image_path,
                                        'is_active' => 0,
                                    ]
                                );

                                $productId = $newProduct->id;
                                $productLocalCache[$supplierProductId] = $productId;
                                ProcessProductBannerImage::dispatch($newProduct->id, $newProduct->image_path);
                            }
                        }

                        if (!$productId && ($variantId || $item->supplier_product_variant_id)) {
                            throw new \Exception('Cannot receive variant: Missing base product. Please ensure the base product exists first.', 422);
                        }

                        if (!$variantId && $item->supplier_product_variant_id && $productId) {
                            $supplierVariant = $existingSupplierVariants->get($item->supplier_product_variant_id);

                            if ($supplierVariant) {
                                $sizeValueId = null;
                                if ($supplierVariant->size) {
                                    $existing = DB::table('variant_values')->where('label', $supplierVariant->size)->where('category', 'size')->first();
                                    $sizeValueId = $existing ? $existing->id : DB::table('variant_values')->insertGetId([
                                        'variant_id' => 1,
                                        'label' => $supplierVariant->size,
                                        'category' => 'size',
                                        'created_at' => now(),
                                        'updated_at' => now(),
                                    ]);
                                }

                                $colorValueId = null;
                                if ($supplierVariant->color) {
                                    $existing = DB::table('variant_values')->where('label', $supplierVariant->color)->where('category', 'color')->first();
                                    $colorValueId = $existing ? $existing->id : DB::table('variant_values')->insertGetId([
                                        'variant_id' => 2,
                                        'label' => $supplierVariant->color,
                                        'category' => 'color',
                                        'created_at' => now(),
                                        'updated_at' => now(),
                                    ]);
                                }

                                $weightValueId = null;
                                if ($supplierVariant->weight) {
                                    $existing = DB::table('variant_values')->where('label', $supplierVariant->weight)->where('category', 'weight')->first();
                                    $weightValueId = $existing ? $existing->id : DB::table('variant_values')->insertGetId([
                                        'variant_id' => 3,
                                        'label' => $supplierVariant->weight,
                                        'category' => 'weight',
                                        'created_at' => now(),
                                        'updated_at' => now(),
                                    ]);
                                }

                                $newVariant = ProductVariant::firstOrCreate(
                                    ['product_id' => $productId, 'size_value_id' => $sizeValueId, 'color_value_id' => $colorValueId, 'weight_value_id' => $weightValueId],
                                    [
                                        'stock' => 0,
                                        'price_override' => $supplierVariant->price_override,
                                        'barcode' => $supplierVariant->barcode ?: null,
                                        'sale_percentage' => 0,
                                        'image_path' => $supplierVariant->image_path,
                                        'additional_images' => $supplierVariant->additional_images,
                                    ]
                                );

                                $variantId = $newVariant->id;
                            }
                        }

                        if (!$inv && $productId) {
                            $inv = Inventory::firstOrCreate(
                                ['product_id' => $productId, 'product_variant_id' => $variantId],
                                [
                                    'supplier_product_id' => $item->supplier_product_id,
                                    'supplier_product_variant_id' => $item->supplier_product_variant_id,
                                    'current_stock' => 0,
                                    'warehouse_stock' => 0,
                                    'reorder_threshold' => 10,
                                ]
                            );
                        }
                    }

                    if ($inv) {
                        $inv->increment('warehouse_stock', $item->quantity);
                        $inv->update(['last_adjusted_at' => now()]);

                        $item->update([
                            'product_id' => $inv->product_id,
                            'product_variant_id' => $inv->product_variant_id,
                        ]);

                        InventoryAdjustment::create([
                            'product_id' => $inv->product_id,
                            'user_id' => auth()->id(),
                            'type' => 'add',
                            'quantity' => $item->quantity,
                            'note' => "Received from PO #{$po->po_number}",
                        ]);
                    }
                }

                $po->update(['status' => 'received']);
                return $po;
            });

            if (Cache::getStore() instanceof \Illuminate\Cache\TaggableStore) {
                Cache::tags(['inventory', 'products'])->flush();
            }

            broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_inventory', 'admin_dashboard', 'supplier_products'], 'purchase_order.received'));
            broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.received'));

            return [
                'data' => $po->fresh()->load(['supplier', 'items.product', 'items.productVariant']),
                'status_code' => 200,
            ];

        } catch (\Exception $e) {
            \Log::error('Error marking PO as received: ' . $e->getMessage(), [
                'id' => $id,
                'trace' => $e->getTraceAsString()
            ]);

            return [
                'error' => $e->getMessage(),
                'status_code' => $e->getCode() ?: 500,
            ];
        }
    }
}
