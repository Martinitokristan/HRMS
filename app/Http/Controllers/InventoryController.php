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
        // Query local storefront products
        $pQuery = Product::with(['category', 'unitType', 'supplier', 'inventory', 'productVariants.sizeValue', 'productVariants.colorValue', 'productVariants.weightValue']);
        
        // Query warehouse-only items (not yet in storefront)
        $wQuery = Inventory::with(['supplierProduct.category', 'supplierProduct.supplier', 'supplierProduct.variants'])
            ->whereNull('product_id')
            ->whereNotNull('supplier_product_id');

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

        // Note: For simplicity, pagination is done on Products first, then Orphans are appended or merged.
        // In a high-volume system, we'd use a Union. But for now, let's fetch matching Orphans.
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

        $flattened = [];
        
        // Group orphan inventory records by supplier_product_id to avoid duplicate variant rows
        $orphansBySupplier = $orphans->groupBy('supplier_product_id');

        foreach ($orphansBySupplier as $spId => $spOrphans) {
            $sp = $spOrphans->first()->supplierProduct;

            if ($sp->variants && $sp->variants->count() > 0) {
                // Build a lookup: supplier_product_variant_id => inventory record
                $variantInvMap = $spOrphans->keyBy('supplier_product_variant_id');
                
                // First, emit the base product row
                $baseInv = $spOrphans->whereNull('supplier_product_variant_id')->first()
                        ?? $spOrphans->first();
                $baseWarehouseStock = $baseInv ? $baseInv->warehouse_stock : 0;
                
                $flattened[] = [
                    'id'                          => "o-{$baseInv->id}",
                    'raw_id'                      => $baseInv ? $baseInv->id : null,
                    'product_id'                  => null,
                    'variant_id'                  => null,
                    'supplier_product_id'         => $spId,
                    'supplier_product_variant_id' => null,
                    'barcode'                     => $sp->barcode ?? 'N/A',
                    'name'                        => $sp->name,
                    'supplier'                    => $sp->supplier ? $sp->supplier->name : '-',
                    'category'                    => $sp->category ? $sp->category->name : '-',
                    'category_id'                 => $sp->category_id,
                    'unit'                        => 'Units',
                    'current_stock'               => 0,
                    'warehouse_stock'             => $baseWarehouseStock,
                    'reorder_threshold'           => $baseInv ? $baseInv->reorder_threshold : 10,
                    'purchase_price'              => $sp->price,
                    'sell_price'                  => null,
                    'description'                 => $sp->description,
                    'unit_type_id'                => null,
                    'size'                        => '-',
                    'color'                       => '-',
                    'weight'                      => '-',
                            'barcode_suffix'              => '',
                    'is_variant'                  => false,
                    'is_orphan'                   => true,
                    'supplier_variant_count'      => $sp->variants->count(),
                    'total_sold'                  => 0,
                    'total_imported'              => $baseWarehouseStock,
                ];

                // Then emit all variant rows
                foreach ($sp->variants as $sv) {
                    // Use the variant-specific inventory record if it exists, else the base one
                    $invForVariant = $variantInvMap->get($sv->id) ?? $baseInv;
                    $warehouseStock = $invForVariant ? $invForVariant->warehouse_stock : ($sv->stock ?? 0);

                    $flattened[] = [
                        'id'                          => "sv-{$sv->id}",
                        'raw_id'                      => $invForVariant ? $invForVariant->id : null,
                        'product_id'                  => null,
                        'variant_id'                  => null,
                        'supplier_product_id'         => $spId,
                        'supplier_product_variant_id' => $sv->id,
                        'barcode'                     => $sp->barcode . ($sv->barcode_suffix ? "-{$sv->barcode_suffix}" : ""),
                        'name'                        => $sp->name,
                        'supplier'                    => $sp->supplier ? $sp->supplier->name : '-',
                        'category'                    => $sp->category ? $sp->category->name : '-',
                        'category_id'                 => $sp->category_id,
                        'unit'                        => 'Units',
                        'current_stock'               => 0,
                        'warehouse_stock'             => $warehouseStock,
                        'reorder_threshold'           => $invForVariant ? $invForVariant->reorder_threshold : 10,
                        'purchase_price'              => $sv->price_override ?? $sp->price,
                        'sell_price'                  => null,
                        'description'                 => $sp->description,
                        'unit_type_id'                => null,
                        'size'                        => $sv->size ?? '-',
                        'color'                       => $sv->color ?? '-',
                        'weight'                      => $sv->weight ?? '-',
                        'barcode_suffix'              => $sv->barcode_suffix,
                        'is_variant'                  => true,
                        'is_orphan'                   => true,
                        'supplier_variant_count'      => 0,
                        'total_sold'                  => 0,
                        'total_imported'              => $warehouseStock,
                    ];
                }
            } else {
                // No variants — use the base inventory record (no supplier_product_variant_id)
                $baseInv = $spOrphans->whereNull('supplier_product_variant_id')->first()
                        ?? $spOrphans->first();

                $flattened[] = [
                    'id'                     => "o-{$baseInv->id}",
                    'raw_id'                 => $baseInv->id,
                    'product_id'             => null,
                    'variant_id'             => null,
                    'supplier_product_id'    => $spId,
                    'barcode'                => $sp->barcode ?? 'N/A',
                    'name'                   => $sp->name,
                    'supplier'               => $sp->supplier ? $sp->supplier->name : '-',
                    'category'               => $sp->category ? $sp->category->name : '-',
                    'category_id'            => $sp->category_id,
                    'unit'                   => 'Units',
                    'current_stock'          => 0,
                    'warehouse_stock'        => $baseInv->warehouse_stock,
                    'reorder_threshold'      => $baseInv->reorder_threshold,
                    'purchase_price'         => $sp->price,
                    'sell_price'             => null,
                    'description'            => $sp->description,
                    'unit_type_id'           => null,
                    'size'                   => '-',
                    'color'                  => '-',
                    'weight'                 => '-',
                    'is_variant'             => false,
                    'is_orphan'              => true,
                    'supplier_variant_count' => 0,
                    'total_sold'             => 0,
                    'total_imported'         => $baseInv->warehouse_stock,
                ];
            }
        }

        foreach ($products as $p) {
            if ($p->productVariants->count() > 0) {
                // Find base inventory (no variant) for this product
                $baseInv = Inventory::where('product_id', $p->id)->whereNull('product_variant_id')->first();
                $baseSoldKey = $p->id . '-0';

                // Emit base product row so admin can transfer base stock independently
                $flattened[] = [
                    'id' => "p-{$p->id}",
                    'raw_id' => $baseInv ? $baseInv->id : null,
                    'product_id' => $p->id,
                    'variant_id' => null,
                    'barcode' => $p->barcode,
                    'name' => $p->name,
                    'supplier' => $p->supplier ? $p->supplier->name : '-',
                    'category' => $p->category ? $p->category->name : '-',
                    'category_id' => $p->category_id,
                    'unit' => $p->unitType ? $p->unitType->sell_unit : '-',
                    'unit_type_id' => $p->unit_type_id,
                    'current_stock' => $baseInv ? $baseInv->current_stock : 0,
                    'warehouse_stock' => $baseInv ? $baseInv->warehouse_stock : 0,
                    'reorder_threshold' => $baseInv ? $baseInv->reorder_threshold : 10,
                    'purchase_price' => $p->purchase_price,
                    'sell_price' => $p->sell_price,
                    'description' => $p->description,
                    'size' => '-',
                    'color' => '-',
                    'weight' => '-',
                    'is_variant' => false,
                    'is_base_of_variants' => true,
                    'total_sold' => isset($soldByProduct[$baseSoldKey]) ? (int) $soldByProduct[$baseSoldKey]->total_sold : 0,
                    'total_imported' => 0,
                ];

                foreach ($p->productVariants as $v) {
                    $soldKey = $p->id . '-' . $v->id;
                    $varInv = Inventory::where('product_id', $p->id)->where('product_variant_id', $v->id)->first();
                    $flattened[] = [
                        'id' => "v-{$v->id}",
                        'raw_id' => $varInv ? $varInv->id : null,
                        'product_id' => $p->id,
                        'variant_id' => $v->id,
                        'barcode' => $p->barcode . ($v->barcode_suffix ? "-{$v->barcode_suffix}" : ""),
                        'name' => $p->name,
                        'supplier' => $p->supplier ? $p->supplier->name : '-',
                        'category' => $p->category ? $p->category->name : '-',
                        'category_id' => $p->category_id,
                        'unit' => $p->unitType ? $p->unitType->sell_unit : '-',
                        'unit_type_id' => $p->unit_type_id,
                        'current_stock' => $v->stock,
                        'warehouse_stock' => $varInv ? $varInv->warehouse_stock : 0,
                        'reorder_threshold' => $baseInv ? $baseInv->reorder_threshold : 10,
                        'purchase_price' => $p->purchase_price,
                        'sell_price' => $v->sell_price ?? $p->sell_price,
                        'description' => $p->description,
                        'size' => ($v->sizeValue && $v->sizeValue->label) ? $v->sizeValue->label : '-',
                        'color' => ($v->colorValue && $v->colorValue->label) ? $v->colorValue->label : '-',
                        'weight' => ($v->weightValue && $v->weightValue->label) ? $v->weightValue->label : '-',
                        'is_variant' => true,
                        'total_sold' => isset($soldByProduct[$soldKey]) ? (int) $soldByProduct[$soldKey]->total_sold : 0,
                        'total_imported' => 0,
                    ];
                }
            } else {
                $soldKey = $p->id . '-0';
                $flattened[] = [
                    'id' => "p-{$p->id}",
                    'raw_id' => $p->inventory ? $p->inventory->id : null,
                    'product_id' => $p->id,
                    'variant_id' => null,
                    'barcode' => $p->barcode,
                    'name' => $p->name,
                    'supplier' => $p->supplier ? $p->supplier->name : '-',
                    'category' => $p->category ? $p->category->name : '-',
                    'category_id' => $p->category_id,
                    'unit' => $p->unitType ? $p->unitType->sell_unit : '-',
                    'unit_type_id' => $p->unit_type_id,
                    'current_stock' => $p->inventory ? $p->inventory->current_stock : 0,
                    'warehouse_stock' => $p->inventory ? $p->inventory->warehouse_stock : 0,
                    'reorder_threshold' => $p->inventory ? $p->inventory->reorder_threshold : 10,
                    'purchase_price' => $p->purchase_price,
                    'sell_price' => $p->sell_price,
                    'description' => $p->description,
                    'size' => '-',
                    'color' => '-',
                    'weight' => '-',
                    'is_variant' => false,
                    'total_sold' => isset($soldByProduct[$soldKey]) ? (int) $soldByProduct[$soldKey]->total_sold : 0,
                    'total_imported' => 0,
                ];
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
                $product->syncStockWithVariants();
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
                        'barcode'        => !empty($pd['barcode']) ? $pd['barcode'] : ($sp->barcode ?? ('BARCODE-' . str_pad(Product::count() + 1, 6, '0', STR_PAD_LEFT))),
                        'description'    => !empty($pd['description']) ? $pd['description'] : $sp->description,
                        'category_id'    => !empty($pd['category_id']) ? $pd['category_id'] : $sp->category_id,
                        'supplier_id'    => $sp->supplier_id,
                        'unit_type_id'   => $unitTypeId,
                        'purchase_price' => !empty($pd['purchase_price']) ? $pd['purchase_price'] : $sp->price,
                        'sell_price'     => !empty($pd['sell_price']) ? $pd['sell_price'] : ($sp->price * 1.3),
                        'image_path'     => $sp->image_path,
                        'is_active'      => false, 
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
                            $newVariant = \App\Models\ProductVariant::create([
                                'product_id' => $productId,
                                'size_value_id' => $sizeValueId,
                                'color_value_id' => $colorValueId,
                                'weight_value_id' => $weightValueId,
                                'stock' => 0,
                                'price_override' => $priceOverride,
                                'barcode_suffix' => $spVariant->barcode_suffix,
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
                        if (count($updateData) > 0) {
                            $product->update($updateData);
                        }
                    }
                }
            }

            // Deduct from warehouse
            $inv->decrement('warehouse_stock', $data['quantity']);

            // Add to storefront
            $inv->refresh(); // ensure product_id / product_variant_id are up to date after save
            if ($inv->product_variant_id) {
                $variant = \App\Models\ProductVariant::findOrFail($inv->product_variant_id);
                $variant->increment('stock', $data['quantity']);
                $product = Product::find($inv->product_id);
                if ($product) {
                    $product->syncStockWithVariants();
                }
            } else {
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
                }
                
                $baseInventory->increment('current_stock', $data['quantity']);
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
                            $unitTypeId = !empty($baseProductData['unit_type_id']) ? $baseProductData['unit_type_id'] : 1;
                            
                            $product = Product::create([
                                'name'           => !empty($baseProductData['name']) ? $baseProductData['name'] : $sp->name,
                                'barcode'        => !empty($baseProductData['barcode']) ? $baseProductData['barcode'] : ($sp->barcode ?? ('BARCODE-' . str_pad(Product::count() + 1, 6, '0', STR_PAD_LEFT))),
                                'description'    => !empty($baseProductData['description']) ? $baseProductData['description'] : $sp->description,
                                'category_id'    => !empty($baseProductData['category_id']) ? $baseProductData['category_id'] : $sp->category_id,
                                'supplier_id'    => $sp->supplier_id,
                                'unit_type_id'   => $unitTypeId,
                                'purchase_price' => !empty($baseProductData['purchase_price']) ? $baseProductData['purchase_price'] : $sp->price,
                                'sell_price'     => !empty($baseProductData['sell_price']) ? $baseProductData['sell_price'] : ($sp->price * 1.3),
                                'image_path'     => $sp->image_path,
                                'is_active'      => false,
                            ]);
                            
                            $productId = $product->id;
                        }
                    } else {
                        $productId = $inv->product_id;
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
                    
                    // Sync product stock with all variants
                    $inv->product->syncStockWithVariants();
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
}
