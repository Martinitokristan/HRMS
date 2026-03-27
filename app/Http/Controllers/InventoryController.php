<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\InventoryAdjustment;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\POItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        // Optimized: Load essential relationships for list view including variants
        $pQuery = Product::with(['category', 'inventory', 'inventory.supplierProduct.variants', 'productVariants.sizeValue', 'productVariants.colorValue', 'productVariants.weightValue']);
        
        // Query warehouse-only items (orphans)
        $wQuery = Inventory::with(['supplierProduct.category', 'supplierProduct.supplier'])
            ->whereNull('product_id')
            ->whereNotNull('supplier_product_id')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('inventory as inv2')
                    ->whereColumn('inv2.supplier_product_id', 'inventory.supplier_product_id')
                    ->whereNotNull('inv2.product_id');
            });

        if ($request->filled('search')) {
            $s = $request->search;
            $pQuery->where(fn($q) => $q->where('name', 'like', "%$s%")->orWhere('barcode', 'like', "%$s%"));
            $wQuery->whereHas('supplierProduct', fn($q) => $q->where('name', 'like', "%$s%")->orWhere('barcode', 'like', "%$s%"));
        }

        if ($request->filled('category_id')) {
            $pQuery->where('category_id', $request->category_id);
            $wQuery->whereHas('supplierProduct', fn($q) => $q->where('category_id', $request->category_id));
        }

        if ($request->filled('supplier_id')) {
            $pQuery->where('supplier_id', $request->supplier_id);
            $wQuery->whereHas('supplierProduct', fn($q) => $q->where('supplier_id', $request->supplier_id));
        }

        $perPage = $request->get('per_page', 15);
        $products = $pQuery->paginate($perPage);
        $orphans = $wQuery->get();

        // Pre-load sold/imported quantities
        $productIds = $products->pluck('id')->toArray();
        $soldByProduct = \App\Models\SaleItem::whereIn('product_id', $productIds)
            ->selectRaw('product_id, product_variant_id, SUM(quantity) as total_sold')
            ->groupBy('product_id', 'product_variant_id')
            ->get()
            ->keyBy(fn($item) => $item->product_id . '-' . ($item->product_variant_id ?: '0'));

        $importedByProduct = \App\Models\POItem::whereIn('product_id', $productIds)
            ->whereHas('purchaseOrder', function($q) {
                $q->where('status', 'supplier_delivered')
                  ->orWhere('status', 'received');
            })
            ->selectRaw('product_id, product_variant_id, SUM(quantity) as total_imported')
            ->groupBy('product_id', 'product_variant_id')
            ->get()
            ->keyBy(fn($item) => $item->product_id . '-' . ($item->product_variant_id ?: '0'));

        $spIds = $orphans->pluck('supplier_product_id')->unique()->toArray();
        $importedBySupplierProduct = \App\Models\POItem::whereIn('supplier_product_id', $spIds)
            ->whereNull('product_id')
            ->whereHas('purchaseOrder', function($q) {
                $q->where('status', 'supplier_delivered')
                  ->orWhere('status', 'received');
            })
            ->selectRaw('supplier_product_id, supplier_product_variant_id, SUM(quantity) as total_imported')
            ->groupBy('supplier_product_id', 'supplier_product_variant_id')
            ->get()
            ->keyBy(fn($item) => $item->supplier_product_id . '-' . ($item->supplier_product_variant_id ?: '0'));

        $flattened = [];
        $orphansBySupplier = $orphans->groupBy('supplier_product_id');

        // Handle Orphans (Warehouse only items)
        foreach ($orphansBySupplier as $spId => $spOrphans) {
            $sp = $spOrphans->first()->supplierProduct;
            $baseInv = $spOrphans->whereNull('supplier_product_variant_id')->first() ?? $spOrphans->first();

            $flattened[] = $this->formatInventoryRow($baseInv, $sp, null, [
                'is_orphan' => true, 
                'is_base_of_variants' => $sp->variants->count() > 0,
                'imported_key' => $sp->id . '-0',
                'imported_by_product' => $importedBySupplierProduct
            ]);

            if ($sp->variants->count() > 0) {
                $variantInvMap = $spOrphans->keyBy('supplier_product_variant_id');
                foreach ($sp->variants as $sv) {
                    $invForVariant = $variantInvMap->get($sv->id);
                    $flattened[] = $this->formatInventoryRow($invForVariant ?: $baseInv, $sp, $sv, [
                        'is_orphan' => true, 
                        'is_variant' => true,
                        'imported_key' => $sp->id . '-' . $sv->id,
                        'imported_by_product' => $importedBySupplierProduct
                    ]);
                }
            }
        }

        // Handle Real Products
        foreach ($products as $p) {
            $baseInv = Inventory::where('product_id', $p->id)->whereNull('product_variant_id')->first();
            $hasVariants = $p->productVariants->count() > 0 || ($p->inventory && $p->inventory->supplierProduct && $p->inventory->supplierProduct->variants->count() > 0);
            
            // Base product row
            $flattened[] = $this->formatInventoryRow($baseInv, $p->inventory->supplierProduct ?? null, null, [
                'product' => $p,
                'is_base_of_variants' => $hasVariants,
                'sold_key' => $p->id . '-0',
                'sold_by_product' => $soldByProduct,
                'imported_key' => $p->id . '-0',
                'imported_by_product' => $importedByProduct
            ]);

            // Real variants
            foreach ($p->productVariants as $v) {
                $varInv = Inventory::where('product_id', $p->id)->where('product_variant_id', $v->id)->first();
                $flattened[] = $this->formatInventoryRow($varInv, $p->inventory->supplierProduct ?? null, $v, [
                    'product' => $p,
                    'is_variant' => true,
                    'sold_key' => $p->id . '-' . $v->id,
                    'sold_by_product' => $soldByProduct,
                    'imported_key' => $p->id . '-' . $v->id,
                    'imported_by_product' => $importedByProduct
                ]);
            }

            // Virtual supplier variants
            if ($p->inventory && $p->inventory->supplierProduct) {
                foreach ($p->inventory->supplierProduct->variants as $sv) {
                    $svInv = Inventory::where('supplier_product_variant_id', $sv->id)->first();
                    if ($svInv && $svInv->product_variant_id) continue;
                    
                    $flattened[] = $this->formatInventoryRow($svInv, $p->inventory->supplierProduct, $sv, [
                        'product' => $p,
                        'is_variant' => true,
                        'imported_key' => $p->inventory->supplierProduct->id . '-' . $sv->id,
                        'imported_by_product' => $importedBySupplierProduct
                    ]);
                }
            }
        }

        $variantMeta = [
            'sizes'   => \App\Models\VariantValue::whereHas('variant', fn($q) => $q->where('name', 'Size'))->pluck('label')->unique()->values(),
            'colors'  => \App\Models\VariantValue::whereHas('variant', fn($q) => $q->where('name', 'Color'))->pluck('label')->unique()->values(),
            'weights' => \App\Models\VariantValue::whereHas('variant', fn($q) => $q->where('name', 'Weight'))->pluck('label')->unique()->values(),
        ];

        $responseData = $products->toArray();
        $responseData['data'] = $flattened;

        return response()->json([
            'data'           => $responseData,
            'variant_meta'   => $variantMeta,
            'low_stock_count' => Inventory::whereRaw('current_stock <= reorder_threshold')->count(),
            'status'         => 'success',
        ]);
    }

    public function adjust(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'type'       => 'required|in:add,subtract,set',
            'quantity'   => 'required|numeric|min:0',
            'reason'     => 'nullable|string',
        ]);

        $product = Product::findOrFail($data['product_id']);
        
        DB::transaction(function () use ($product, $data, $request) {
            if ($data['variant_id']) {
                $variant = \App\Models\ProductVariant::findOrFail($data['variant_id']);
                if ($data['type'] === 'add') {
                    $variant->increment('stock', $data['quantity']);
                } elseif ($data['type'] === 'subtract') {
                    $variant->decrement('stock', $data['quantity']);
                } else {
                    $variant->update(['stock' => $data['quantity']]);
                }
                // NOTE: Removed syncStockWithVariants() to keep base product and variant stocks independent
            } else {
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
                'product_id' => $product->id,
                'user_id'    => $request->user()->id,
                'type'       => $data['type'],
                'quantity'   => $data['quantity'],
                'note'       => $data['reason'] ?? null,
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Stock adjusted successfully',
            'status'  => 'success',
        ]);
    }

    public function reorder(Request $request, $id)
    {
        $product = Product::with(['supplier'])->findOrFail($id);
        $inventory = Inventory::where('product_id', $id)->firstOrFail();

        if (!$product->supplier_id) {
            return response()->json([
                'message' => 'Product has no supplier assigned.',
                'status'  => 'error',
            ], 422);
        }

        $reorderQty = $inventory->reorder_threshold * 2;
        $po = DB::transaction(function () use ($product, $reorderQty, $request) {
            $po = PurchaseOrder::create([
                'po_number'     => 'PO-' . str_pad(PurchaseOrder::count() + 1, 4, '0', STR_PAD_LEFT),
                'supplier_id'   => $product->supplier_id,
                'created_by'    => $request->user()->id,
                'is_auto'       => true,
                'status'        => 'draft',
                'total_cost'    => $reorderQty * $product->purchase_price,
            ]);

            POItem::create([
                'purchase_order_id' => $po->id,
                'product_id'        => $product->id,
                'quantity'          => $reorderQty,
                'unit_cost'         => $product->purchase_price,
                'subtotal'          => $reorderQty * $product->purchase_price,
            ]);

            return $po;
        });

        return response()->json([
            'data'    => $po->load(['supplier', 'items.product']),
            'message' => 'Reorder PO created successfully',
            'status'  => 'success',
        ], 201);
    }


    public function transferToStore(Request $request)
    {
        // Helper function to generate truly unique barcodes
        $generateUniqueBarcode = function($prefix = 'BARCODE-') {
            $maxId = \App\Models\Product::max('id') ?? 0;
            $baseNumber = $maxId + 1;
            
            do {
                $barcode = $prefix . str_pad($baseNumber, 6, '0', STR_PAD_LEFT);
                $exists = \App\Models\Product::where('barcode', $barcode)->exists();
                if ($exists) {
                    $baseNumber++; // Increment if barcode exists
                }
            } while ($exists);
            
            return $barcode;
        };

        \Log::info('transferToStore request', [
            'all' => $request->all(),
            'inventory_id' => $request->input('inventory_id'),
            'quantity' => $request->input('quantity'),
        ]);

        $data = $request->validate([
            'inventory_id' => 'nullable',
            'product_id'   => 'nullable|exists:products,id',
            'variant_id'   => 'nullable|exists:product_variants,id',
            'quantity'     => 'required|numeric|min:1',
            'product_data' => 'nullable|array',
            'product_data.name' => 'nullable|string',
            'product_data.barcode' => 'nullable|string',
            'product_data.category_id' => 'nullable|integer',
            'product_data.unit_type_id' => 'nullable|integer',
            'product_data.sell_price' => 'nullable|numeric',
            'product_data.description' => 'nullable|string',
            'product_data.purchase_price' => 'nullable|numeric',
        ]);

        try {
        $result = DB::transaction(function () use ($data, $request) {
            $inv = null;
            
            if (isset($data['inventory_id'])) {
                // Check if it's a supplier product variant ID (prefixed with 'spv-')
                if (strpos($data['inventory_id'], 'spv-') === 0) {
                    $supplierVariantId = (int) substr($data['inventory_id'], 4);
                    
                    // Find or create inventory for this supplier product variant
                    $spVariant = \App\Models\SupplierProductVariant::findOrFail($supplierVariantId);
                    $inv = Inventory::where('supplier_product_variant_id', $supplierVariantId)->first();
                    
                    if (!$inv) {
                        // Create new inventory record for this supplier variant
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

            \Log::info('Inventory found', ['inv_id' => $inv->id, 'warehouse_stock' => $inv->warehouse_stock, 'quantity' => $data['quantity']]);

            if ($inv->warehouse_stock < $data['quantity']) {
                \Log::error('Insufficient stock', ['warehouse' => $inv->warehouse_stock, 'requested' => $data['quantity']]);
                abort(422, 'Insufficient warehouse stock for transfer.');
            }

            // Logic for "Orphan" items (Supplier Product not yet in Store)
            \Log::info('Checking orphan status', ['product_id' => $inv->product_id, 'supplier_product_id' => $inv->supplier_product_id]);
            if (!$inv->product_id && $inv->supplier_product_id) {
                // Check if any variant of this supplier product already created a local product
                $existingInv = \App\Models\Inventory::where('supplier_product_id', $inv->supplier_product_id)
                    ->whereNotNull('product_id')->first();
                $sp = $inv->supplierProduct;
                $pd = $data['product_data'] ?? [];
                    
                if ($existingInv) {
                    $productId = $existingInv->product_id;
                } else {
                    // Ensure unit_type_id has a valid value
                    $unitTypeId = 1; // Default fallback
                    if (!empty($pd['unit_type_id'])) {
                        $unitTypeId = $pd['unit_type_id'];
                    } elseif (\App\Models\UnitType::count() > 0) {
                        $unitTypeId = \App\Models\UnitType::first()->id;
                    }
                    
                    // 1. Create Product from Supplier Product / Admin Input
                    $product = Product::create([
                        'name'           => !empty($pd['name']) ? $pd['name'] : $sp->name,
                        'barcode'        => !empty($pd['barcode']) ? $pd['barcode'] : ($sp->barcode ?? $generateUniqueBarcode()),
                        'description'    => !empty($pd['description']) ? $pd['description'] : $sp->description,
                        'category_id'    => !empty($pd['category_id']) ? $pd['category_id'] : $sp->category_id,
                        'supplier_id'    => $sp->supplier_id,
                        'unit_type_id'   => $unitTypeId,
                        'purchase_price' => !empty($pd['purchase_price']) ? $pd['purchase_price'] : $sp->price,
                        'sell_price'     => !empty($pd['sell_price']) ? $pd['sell_price'] : ($sp->price * 1.3),
                        'image_path'     => $sp->image_path,
                        'is_active'      => true, 
                    ]);
                    $productId = $product->id;
                }

                // 2. Link Inventory to new Product and map Variants
                $inv->product_id = $productId;
                
                if (!$inv->product_variant_id && $inv->supplier_product_variant_id) {
                    $spVariant = \App\Models\SupplierProductVariant::find($inv->supplier_product_variant_id);
                    if ($spVariant) {
                        $sizeValueId = $spVariant->size ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Size'], ['status' => 1])->id, 'label' => $spVariant->size])->id : null;
                        $colorValueId = $spVariant->color ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Color'], ['status' => 1])->id, 'label' => $spVariant->color])->id : null;
                        $weightValueId = $spVariant->weight ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Weight'], ['status' => 1])->id, 'label' => $spVariant->weight])->id : null;

                        $priceOverride = !empty($pd['sell_price']) ? $pd['sell_price'] : ($spVariant->price_override ? $spVariant->price_override * 1.3 : null);

                        // Check if a product variant with these exact attributes already exists
                        $existingVariant = \App\Models\ProductVariant::where('product_id', $productId)
                            ->where('size_value_id', $sizeValueId)
                            ->where('color_value_id', $colorValueId)
                            ->where('weight_value_id', $weightValueId)
                            ->first();

                        if ($existingVariant) {
                            // Use existing variant instead of creating duplicate, but update images if missing
                            if (!$existingVariant->additional_images && $spVariant->additional_images) {
                                $existingVariant->update(['additional_images' => $spVariant->additional_images]);
                            }
                            $inv->product_variant_id = $existingVariant->id;
                        } else {
                            // Create new variant only if it doesn't exist
                            // Generate unique barcode for variant (different from parent product)
                            $variantBarcode = $generateUniqueBarcode('VAR-'); // Use VAR- prefix for variants
                            
                            $newVariant = \App\Models\ProductVariant::create([
                                'product_id' => $productId,
                                'size_value_id' => $sizeValueId,
                                'color_value_id' => $colorValueId,
                                'weight_value_id' => $weightValueId,
                                'stock' => 0,
                                'price_override' => $priceOverride,
                                'barcode' => $variantBarcode, // Use generated unique barcode
                                'sale_percentage' => 0,
                                'image_path' => $spVariant->image_path,
                                'additional_images' => $spVariant->additional_images,
                            ]);
                            $inv->product_variant_id = $newVariant->id;
                        }
                    }
                }
                $inv->save();
            } else {
                $productId = $inv->product_id;
                
                // Update existing product with admin's retail pricing and details
                if (!empty($data['product_data'])) {
                    $pd = $data['product_data'];
                    $product = Product::find($productId);
                    if ($product) {
                        $updateData = [];
                        if (!empty($pd['name'])) $updateData['name'] = $pd['name'];
                        if (!empty($pd['barcode'])) $updateData['barcode'] = $pd['barcode'];
                        if (!empty($pd['description'])) $updateData['description'] = $pd['description'];
                        if (!empty($pd['category_id'])) $updateData['category_id'] = $pd['category_id'];
                        if (!empty($pd['sell_price'])) $updateData['sell_price'] = $pd['sell_price'];
                        
                        // Always activate product when transferring to storefront
                        $updateData['is_active'] = true;
                        
                        if (count($updateData) > 0) {
                            $product->update($updateData);
                        }
                    }
                }
                
                // Handle supplier variant creation for non-orphan items
                if (!$inv->product_variant_id && $inv->supplier_product_variant_id) {
                    $spVariant = \App\Models\SupplierProductVariant::find($inv->supplier_product_variant_id);
                    if ($spVariant) {
                        $sizeValueId = $spVariant->size ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Size'], ['status' => 1])->id, 'label' => $spVariant->size])->id : null;
                        $colorValueId = $spVariant->color ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Color'], ['status' => 1])->id, 'label' => $spVariant->color])->id : null;
                        $weightValueId = $spVariant->weight ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Weight'], ['status' => 1])->id, 'label' => $spVariant->weight])->id : null;

                        $priceOverride = !empty($pd['sell_price']) ? $pd['sell_price'] : ($spVariant->price_override ? $spVariant->price_override * 1.3 : null);

                        // Check if a product variant with these exact attributes already exists
                        $existingVariant = \App\Models\ProductVariant::where('product_id', $productId)
                            ->where('size_value_id', $sizeValueId)
                            ->where('color_value_id', $colorValueId)
                            ->where('weight_value_id', $weightValueId)
                            ->first();

                        if ($existingVariant) {
                            // Use existing variant instead of creating duplicate
                            $inv->product_variant_id = $existingVariant->id;
                        } else {
                            // Create new variant only if it doesn't exist
                            $variantBarcode = $generateUniqueBarcode('VAR-');
                            
                            $newVariant = \App\Models\ProductVariant::create([
                                'product_id' => $productId,
                                'size_value_id' => $sizeValueId,
                                'color_value_id' => $colorValueId,
                                'weight_value_id' => $weightValueId,
                                'stock' => 0,
                                'price_override' => $priceOverride,
                                'barcode' => $variantBarcode,
                                'sale_percentage' => 0,
                                'image_path' => $spVariant->image_path,
                                'additional_images' => $spVariant->additional_images,
                            ]);
                            $inv->product_variant_id = $newVariant->id;
                        }
                    }
                }
            }

            // Deduct from warehouse
            $inv->decrement('warehouse_stock', $data['quantity']);

            // Add to storefront
            $inv->refresh(); // ensure product_id / product_variant_id are up to date after save
            
            \Log::info('Stock Transfer Details', [
                'inventory_id' => $inv->id,
                'product_id' => $inv->product_id,
                'product_variant_id' => $inv->product_variant_id,
                'supplier_product_variant_id' => $inv->supplier_product_variant_id,
                'quantity' => $data['quantity'],
                'warehouse_stock_before' => $inv->warehouse_stock,
                'current_stock_before' => $inv->current_stock,
            ]);
            
            if ($inv->product_variant_id) {
                \Log::info('Transferring to variant', ['variant_id' => $inv->product_variant_id]);
                $variant = \App\Models\ProductVariant::findOrFail($inv->product_variant_id);
                $variant->increment('stock', $data['quantity']);
                
                // Use the current inventory record for the variant (don't create a new one)
                $inv->increment('current_stock', $data['quantity']);
                
                \Log::info('Variant stock updated', [
                    'variant_id' => $inv->product_variant_id,
                    'variant_stock_after' => $variant->fresh()->stock,
                    'inventory_current_stock_after' => $inv->fresh()->current_stock,
                ]);
                
                // NOTE: Removed syncStockWithVariants() to keep base product and variant stocks independent
            } else {
                \Log::info('Transferring to base product', ['product_id' => $inv->product_id]);
                
                // Ensure inventory record exists for base product
                $baseInventory = \App\Models\Inventory::where('product_id', $productId)
                    ->whereNull('product_variant_id')
                    ->first();
                    
                if (!$baseInventory) {
                    $baseInventory = \App\Models\Inventory::create([
                        'product_id' => $productId,
                        'product_variant_id' => null,
                        'supplier_product_id' => $inv->supplier_product_id,
                        'current_stock' => 0,
                        'warehouse_stock' => 0,
                        'reorder_threshold' => 10,
                    ]);
                    \Log::info('Created base inventory record', ['base_inventory_id' => $baseInventory->id]);
                }
                
                $baseInventory->increment('current_stock', $data['quantity']);
                
                \Log::info('Base product stock updated', [
                    'base_inventory_id' => $baseInventory->id,
                    'base_current_stock_after' => $baseInventory->fresh()->current_stock,
                ]);
            }

            InventoryAdjustment::create([
                'product_id' => $productId,
                'user_id'    => $request->user()->id,
                'type'       => 'add',
                'quantity'   => $data['quantity'],
                'note'       => 'Transferred from Warehouse to Storefront (Created Product if Orphan)',
                'created_at' => now(),
            ]);

            return $inv->load('product');
        });

        return response()->json([
            'data'    => $result,
            'message' => 'Stock transferred to storefront successfully. ' . ($result->product ? 'Product is now in store module.' : ''),
            'status'  => 'success',
        ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            \Log::error('transferToStore exception', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => $e->getMessage(), 'status' => 'error'], 422);
        }
    }

    public function transferMultipleToStore(Request $request)
    {
        $data = $request->validate([
            'transfers' => 'required|array|min:1',
            'transfers.*.inventory_id' => 'required|string',
            'transfers.*.quantity' => 'required|numeric|min:1',
            'transfers.*.product_data' => 'nullable|array',
            'transfers.*.product_data.sell_price' => 'nullable|numeric|min:0',
            'base_product_data' => 'nullable|array',
        ]);

        $results = DB::transaction(function () use ($data, $request) {
            $transferredCount = 0;
            $productId = null;
            $baseProductData = $data['base_product_data'] ?? [];

            foreach ($data['transfers'] as $transfer) {
                // Handle supplier product variant IDs (prefixed with 'spv-')
                if (strpos($transfer['inventory_id'], 'spv-') === 0) {
                    $supplierVariantId = (int) substr($transfer['inventory_id'], 4);
                    $spVariant = \App\Models\SupplierProductVariant::findOrFail($supplierVariantId);
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
                        $existingInv = \App\Models\Inventory::where('supplier_product_id', $inv->supplier_product_id)
                            ->whereNotNull('product_id')->first();
                        
                        if ($existingInv) {
                            $productId = $existingInv->product_id;
                        } else {
                            // Create product from supplier product
                            $sp = $inv->supplierProduct;
                            $baseProductData = $data['base_product_data'] ?? [];
                            
                            // Ensure unit_type_id has a valid value
                            $unitTypeId = 1; // Default fallback
                            if (!empty($baseProductData['unit_type_id'])) {
                                $unitTypeId = $baseProductData['unit_type_id'];
                            } elseif (\App\Models\UnitType::count() > 0) {
                                $unitTypeId = \App\Models\UnitType::first()->id;
                            }
                            
                            $product = Product::create([
                                'name'           => !empty($baseProductData['name']) ? $baseProductData['name'] : $sp->name,
                                'barcode'        => !empty($baseProductData['barcode']) ? $baseProductData['barcode'] : $sp->barcode,
                                'description'    => !empty($baseProductData['description']) ? $baseProductData['description'] : $sp->description,
                                'category_id'    => !empty($baseProductData['category_id']) ? $baseProductData['category_id'] : $sp->category_id,
                                'supplier_id'    => $sp->supplier_id,
                                'unit_type_id'   => $unitTypeId,
                                'purchase_price' => !empty($baseProductData['purchase_price']) ? $baseProductData['purchase_price'] : $sp->price,
                                'sell_price'     => !empty($baseProductData['sell_price']) ? $baseProductData['sell_price'] : ($sp->price * 1.3),
                                'image_path'     => $sp->image_path,
                                'is_active'      => true,  // FIXED: Products should be active after transfer
                            ]);
                            
                            $productId = $product->id;
                        }
                    }
                }

                // Link inventory to product if not already linked
                if (!$inv->product_id) {
                    $inv->product_id = $productId;
                    
                    if (!$inv->product_variant_id && $inv->supplier_product_variant_id) {
                        $spVariant = \App\Models\SupplierProductVariant::find($inv->supplier_product_variant_id);
                        if ($spVariant) {
                            $sizeValueId = $spVariant->size ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Size'], ['status' => 1])->id, 'label' => $spVariant->size])->id : null;
                            $colorValueId = $spVariant->color ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Color'], ['status' => 1])->id, 'label' => $spVariant->color])->id : null;
                            $weightValueId = $spVariant->weight ? \App\Models\VariantValue::firstOrCreate(['variant_id' => \App\Models\Variant::firstOrCreate(['name' => 'Weight'], ['status' => 1])->id, 'label' => $spVariant->weight])->id : null;

                            $priceOverride = !empty($transfer['product_data']['sell_price']) ? $transfer['product_data']['sell_price'] : ($spVariant->price_override ? $spVariant->price_override * 1.3 : null);

                            // Check if a product variant with these exact attributes already exists
                            $existingVariant = \App\Models\ProductVariant::where('product_id', $productId)
                                ->where('size_value_id', $sizeValueId)
                                ->where('color_value_id', $colorValueId)
                                ->where('weight_value_id', $weightValueId)
                                ->first();

                            if ($existingVariant) {
                                // Use existing variant instead of creating duplicate
                                $inv->product_variant_id = $existingVariant->id;
                            } else {
                                // Create new variant only if it doesn't exist
                                $newVariant = \App\Models\ProductVariant::create([
                                    'product_id' => $productId,
                                    'size_value_id' => $sizeValueId,
                                    'color_value_id' => $colorValueId,
                                    'weight_value_id' => $weightValueId,
                                    'stock' => 0,
                                    'price_override' => $priceOverride,
                                    'barcode_suffix' => $spVariant->barcode_suffix,
                                    'image_path' => $spVariant->image_path,
                                ]);
                                $inv->product_variant_id = $newVariant->id;
                            }
                        }
                    }

                    $inv->save();
                }

                // Deduct from warehouse
                $inv->decrement('warehouse_stock', $transfer['quantity']);

                // Add to storefront with variant-specific pricing
                if ($inv->product_variant_id) {
                    $variant = \App\Models\ProductVariant::findOrFail($inv->product_variant_id);
                    $variant->increment('stock', $transfer['quantity']);
                    
                    // Update variant price if provided
                    if (!empty($transfer['product_data']['sell_price'])) {
                        $variant->update(['price_override' => $transfer['product_data']['sell_price']]);
                    }
                    
                    // Increment the variant's inventory current_stock
                    $inv->increment('current_stock', $transfer['quantity']);
                } else {
                    $inv->increment('current_stock', $transfer['quantity']);
                }

                // Log adjustment
                InventoryAdjustment::create([
                    'product_id' => $productId,
                    'user_id'    => $request->user()->id,
                    'type'       => 'add',
                    'quantity'   => $transfer['quantity'],
                    'note'       => 'Multi-variant transfer from Warehouse to Storefront',
                    'created_at' => now(),
                ]);

                $transferredCount++;
            }

            return [
                'count' => $transferredCount,
                'product_id' => $productId,
            ];
        });

        return response()->json([
            'data'    => $results,
            'message' => "{$results['count']} variant(s) transferred to storefront successfully.",
            'status'  => 'success',
        ]);
    }

    /**
     * Helper to format inventory rows consistently for the frontend
     */
    private function formatInventoryRow($inv, $sp, $variant = null, $options = [])
    {
        $isOrphan = $options['is_orphan'] ?? false;
        $isVariant = $options['is_variant'] ?? false;
        $product = $options['product'] ?? null;
        $soldByProduct = $options['sold_by_product'] ?? null;
        $soldKey = $options['sold_key'] ?? null;

        $id = $isOrphan ? "o-{$inv->id}" : ($isVariant ? ($variant instanceof \App\Models\ProductVariant ? "v-{$variant->id}" : "sv-{$variant->id}") : "p-{$product->id}");

        $warehouseStock = $inv ? $inv->warehouse_stock : 0;
        $currentStock = $inv ? $inv->current_stock : (($variant instanceof \App\Models\ProductVariant) ? $variant->stock : 0);
        
        // Handle names
        $name = $product ? $product->name : ($sp ? $sp->name : 'Unknown');
        if ($isOrphan && $variant) {
            $name .= " (" . ($variant->size ?? $variant->color ?? $variant->weight) . ")";
        }

        $importedByProduct = $options['imported_by_product'] ?? null;
        $importedKey = $options['imported_key'] ?? null;

        return [
            'id'                          => $id,
            'raw_id'                      => $inv ? $inv->id : null,
            'product_id'                  => $product ? $product->id : null,
            'variant_id'                  => ($variant instanceof \App\Models\ProductVariant) ? $variant->id : null,
            'supplier_product_id'         => $sp ? $sp->id : ($inv ? $inv->supplier_product_id : null),
            'supplier_product_variant_id' => $variant && !($variant instanceof \App\Models\ProductVariant) ? $variant->id : null,
            'barcode'                     => $product ? $product->barcode : ($sp ? $sp->barcode : 'N/A'),
            'name'                        => $name,
            'supplier'                    => ($product && $product->supplier) ? $product->supplier->name : (($sp && $sp->supplier) ? $sp->supplier->name : '-'),
            'category'                    => ($product && $product->category) ? $product->category->name : (($sp && $sp->category) ? $sp->category->name : '-'),
            'category_id'                 => $product ? $product->category_id : ($sp ? $sp->category_id : null),
            'unit'                        => ($product && $product->unitType) ? $product->unitType->sell_unit : 'Units',
            'current_stock'               => $currentStock,
            'warehouse_stock'             => $warehouseStock,
            'reorder_threshold'           => $inv ? $inv->reorder_threshold : 10,
            'purchase_price'              => $variant && isset($variant->price_override) ? $variant->price_override : ($product ? $product->purchase_price : ($sp ? $sp->price : 0)),
            'sell_price'                  => $variant && isset($variant->sell_price) ? $variant->sell_price : ($product ? $product->sell_price : null),
            'description'                 => $product ? $product->description : ($sp ? $sp->description : null),
            'size'                        => $variant ? ($variant->size ?? ($variant->sizeValue->label ?? '-')) : '-',
            'color'                       => $variant ? ($variant->color ?? ($variant->colorValue->label ?? '-')) : '-',
            'weight'                      => $variant ? ($variant->weight ?? ($variant->weightValue->label ?? '-')) : '-',
            'is_variant'                  => $isVariant,
            'is_orphan'                   => $isOrphan,
            'is_base_of_variants'         => $options['is_base_of_variants'] ?? false,
            'total_sold'                  => $soldKey && isset($soldByProduct[$soldKey]) ? (int) $soldByProduct[$soldKey]->total_sold : 0,
            'total_imported'              => $importedKey && isset($importedByProduct[$importedKey]) ? (int) $importedByProduct[$importedKey]->total_imported : 0,
        ];
    }

    /**
     * Shared helper to generate unique barcodes
     */
    private function generateUniqueBarcode($prefix = 'BARCODE-')
    {
        $maxId = \App\Models\Product::max('id') ?? 0;
        $baseNumber = $maxId + 1;
        
        do {
            $barcode = $prefix . str_pad($baseNumber, 6, '0', STR_PAD_LEFT);
            $exists = \App\Models\Product::where('barcode', $barcode)->exists();
            if ($exists) {
                $baseNumber++;
            }
        } while ($exists);
        
        return $barcode;
    }
}
