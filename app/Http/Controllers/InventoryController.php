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
        $wQuery = Inventory::with(['supplierProduct.category', 'supplierProduct.supplier'])
            ->whereNull('product_id')
            ->whereNotNull('supplier_product_id');

        if ($request->filled('search')) {
            $s = $request->search;
            $pQuery->where(fn($q) => $q->where('name', 'like', "%$s%")->orWhere('sku', 'like', "%$s%"));
            $wQuery->whereHas('supplierProduct', fn($q) => $q->where('name', 'like', "%$s%")->orWhere('sku', 'like', "%$s%"));
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
        
        // Add Orphans first (labeled as Warehouse Only)
        foreach ($orphans as $o) {
            $sp = $o->supplierProduct;
            $flattened[] = [
                'id' => "o-{$o->id}",
                'raw_id' => $o->id,
                'product_id' => null,
                'variant_id' => null,
                'supplier_product_id' => $o->supplier_product_id,
                'sku' => $sp->sku ?? 'N/A',
                'name' => $sp->name . ' (Warehouse Only)',
                'supplier' => $sp->supplier ? $sp->supplier->name : '-',
                'category' => $sp->category ? $sp->category->name : '-',
                'unit' => 'Units', 
                'current_stock' => 0,
                'warehouse_stock' => $o->warehouse_stock,
                'reorder_threshold' => $o->reorder_threshold,
                'size' => '-',
                'color' => '-',
                'weight' => '-',
                'is_variant' => false,
                'is_orphan' => true,
                'total_sold' => 0,
                'total_imported' => $o->warehouse_stock, // For orphans, it's all "imported"
            ];
        }

        foreach ($products as $p) {
            if ($p->productVariants->count() > 0) {
                foreach ($p->productVariants as $v) {
                    $soldKey = $p->id . '-' . $v->id;
                    $flattened[] = [
                        'id' => "v-{$v->id}",
                        'raw_id' => Inventory::where('product_id', $p->id)->where('product_variant_id', $v->id)->value('id'),
                        'product_id' => $p->id,
                        'variant_id' => $v->id,
                        'sku' => $p->sku . ($v->sku_suffix ? "-{$v->sku_suffix}" : ""),
                        'name' => $p->name,
                        'supplier' => $p->supplier ? $p->supplier->name : '-',
                        'category' => $p->category ? $p->category->name : '-',
                        'unit' => $p->unitType ? $p->unitType->sell_unit : '-',
                        'current_stock' => $v->stock,
                        'warehouse_stock' => Inventory::where('product_id', $p->id)->where('product_variant_id', $v->id)->value('warehouse_stock') ?? 0,
                        'reorder_threshold' => ($p->inventory && $p->inventory->reorder_threshold) ? $p->inventory->reorder_threshold : 10,
                        'size' => ($v->sizeValue && $v->sizeValue->label) ? $v->sizeValue->label : '-',
                        'color' => ($v->colorValue && $v->colorValue->label) ? $v->colorValue->label : '-',
                        'weight' => ($v->weightValue && $v->weightValue->label) ? $v->weightValue->label : '-',
                        'is_variant' => true,
                        'total_sold' => isset($soldByProduct[$soldKey]) ? (int) $soldByProduct[$soldKey]->total_sold : 0,
                        'total_imported' => 0, // Simplified
                    ];
                }
            } else {
                $soldKey = $p->id . '-0';
                $flattened[] = [
                    'id' => "p-{$p->id}",
                    'raw_id' => $p->inventory ? $p->inventory->id : null,
                    'product_id' => $p->id,
                    'variant_id' => null,
                    'sku' => $p->sku,
                    'name' => $p->name,
                    'supplier' => $p->supplier ? $p->supplier->name : '-',
                    'category' => $p->category ? $p->category->name : '-',
                    'unit' => $p->unitType ? $p->unitType->sell_unit : '-',
                    'current_stock' => $p->inventory ? $p->inventory->current_stock : 0,
                    'warehouse_stock' => $p->inventory ? $p->inventory->warehouse_stock : 0,
                    'reorder_threshold' => $p->inventory ? $p->inventory->reorder_threshold : 10,
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
        $data = $request->validate([
            'inventory_id' => 'nullable|exists:inventory,id',
            'product_id'   => 'nullable|exists:products,id',
            'variant_id'   => 'nullable|exists:product_variants,id',
            'quantity'     => 'required|numeric|min:1',
            'product_data' => 'nullable|array', // For orphans
        ]);

        $result = DB::transaction(function () use ($data, $request) {
            $inv = null;
            if (isset($data['inventory_id'])) {
                $inv = Inventory::findOrFail($data['inventory_id']);
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
                $sp = $inv->supplierProduct;
                $pd = $data['product_data'] ?? [];
                
                // 1. Create Product from Supplier Product / Admin Input
                $product = Product::create([
                    'name'           => $pd['name'] ?? $sp->name,
                    'sku'            => $pd['sku'] ?? ($sp->sku ?? ('SKU-' . str_pad(Product::count() + 1, 6, '0', STR_PAD_LEFT))),
                    'description'    => $pd['description'] ?? $sp->description,
                    'category_id'    => $pd['category_id'] ?? $sp->category_id,
                    'supplier_id'    => $sp->supplier_id,
                    'unit_type_id'   => $pd['unit_type_id'] ?? ($sp->unit_type_id ?? 1),
                    'purchase_price' => $sp->price,
                    'sell_price'     => $pd['sell_price'] ?? ($sp->price * 1.2),
                    'image_path'     => $sp->image_path,
                    'is_active'      => false, 
                ]);

                // 2. Link Inventory to new Product
                $inv->product_id = $product->id;
                $inv->save();
                
                $productId = $product->id;
            } else {
                $productId = $inv->product_id;
            }

            // Deduct from warehouse
            $inv->decrement('warehouse_stock', $data['quantity']);

            // Add to storefront
            if ($inv->product_variant_id) {
                $variant = \App\Models\ProductVariant::findOrFail($inv->product_variant_id);
                $variant->increment('stock', $data['quantity']);
                $inv->product->syncStockWithVariants(); 
            } else {
                $inv->increment('current_stock', $data['quantity']);
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
    }
}
