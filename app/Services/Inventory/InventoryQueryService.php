<?php

namespace App\Services\Inventory;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\VariantValue;
use App\Models\Variant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Cache\TaggableStore;
use Illuminate\Support\Facades\DB;

class InventoryQueryService
{
    /**
     * Get paginated inventory list with filtering, search, and statistics.
     */
    public function getList($request)
    {
        $version = Cache::get('inventory:version', 1);
        $cacheKey = 'inventory:v' . $version . ':' . md5(json_encode($request->only(['search', 'category_id', 'supplier_id', 'page', 'per_page'])));

        $taggable = Cache::getStore() instanceof TaggableStore;
        $cached = ($taggable ? Cache::tags(['inventory']) : Cache::store())->remember($cacheKey, 300, function () use ($request) {
            return $this->buildInventoryResponse($request);
        });

        return $cached;
    }

    /**
     * Build the complete inventory response with variants and orphans.
     */
    private function buildInventoryResponse($request): array
    {
        // Optimized: Load essential relationships for list view including variants.
        // Order newest first so freshly received stock appears immediately on page 1.
        $pQuery = Product::with(['category', 'inventory', 'inventory.supplierProduct.variants', 'productVariants.sizeValue', 'productVariants.colorValue', 'productVariants.weightValue', 'unitType'])
            ->orderByDesc('id');

        // Query warehouse-only items (orphans)
        $wQuery = Inventory::with(['supplierProduct.category', 'supplierProduct.supplier'])
            ->whereNull('product_id')
            ->whereNotNull('supplier_product_id')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('inventory as inv2')
                    ->whereColumn('inv2.supplier_product_id', 'inventory.supplier_product_id')
                    ->whereNotNull('inv2.product_id');
            })
            ->orderByDesc('id');

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

        $perPage = $request->get('per_page', 20);
        $products = $pQuery->paginate($perPage);
        $orphans = $wQuery->get();

        // Pre-load sold/imported quantities
        $productIds = $products->pluck('id')->toArray();
        $soldByProduct = \App\Models\SaleItem::whereIn('sale_items.product_id', $productIds)
            ->whereHas('sale', function ($q) {
                $q->whereNotNull('was_confirmed_at');
            })
            ->selectRaw('product_id, product_variant_id, SUM(quantity) as total_sold')
            ->groupBy('product_id', 'product_variant_id')
            ->get()
            ->keyBy(fn($item) => $item->product_id . '-' . ($item->product_variant_id ?: '0'));

        $importedByProduct = \App\Models\POItem::whereIn('product_id', $productIds)
            ->whereHas('purchaseOrder', function ($q) {
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
            ->whereHas('purchaseOrder', function ($q) {
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
                    if ($svInv && $svInv->product_variant_id)
                        continue;

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
            'sizes' => VariantValue::whereHas('variant', fn($q) => $q->where('name', 'Size'))->pluck('label')->unique()->values()->toArray(),
            'colors' => VariantValue::whereHas('variant', fn($q) => $q->where('name', 'Color'))->pluck('label')->unique()->values()->toArray(),
            'weights' => VariantValue::whereHas('variant', fn($q) => $q->where('name', 'Weight'))->pluck('label')->unique()->values()->toArray(),
        ];

        return [
            'data' => $flattened,
            'variant_meta' => $variantMeta,
            'low_stock_count' => Inventory::where('is_low_stock', 1)->count(),
            'status' => 'success',
        ];
    }

    /**
     * Format a single inventory row for display.
     */
    private function formatInventoryRow($inv, $sp, $variant = null, $options = [])
    {
        $soldKey = $options['sold_key'] ?? null;
        $importedKey = $options['imported_key'] ?? null;
        $soldByProduct = $options['sold_by_product'] ?? [];
        $importedByProduct = $options['imported_by_product'] ?? [];
        $product = $options['product'] ?? null;
        $isOrphan = $options['is_orphan'] ?? false;
        $isVariant = $options['is_variant'] ?? false;
        $isBaseOfVariants = $options['is_base_of_variants'] ?? false;

        $sizeLabel = '';
        $colorLabel = '';
        $weightLabel = '';
        if ($variant) {
            $sizeLabel = $variant->size_value ? $variant->size_value->label : '';
            $colorLabel = $variant->color_value ? $variant->color_value->label : '';
            $weightLabel = $variant->weight_value ? $variant->weight_value->label : '';
        }

        // Determine ID prefix and value
        if ($isOrphan) {
            $id = "o-{$inv->id}";
        } elseif ($isVariant) {
            $id = "v-{$variant->id}";
        } else {
            $id = "p-{$product->id}";
        }

        // Get barcode
        $barcode = $product ? $product->barcode : ($sp ? $sp->barcode : null);

        // Get name
        $name = $product ? $product->name : ($sp ? $sp->name : 'Unknown');

        // Get supplier (string only)
        $supplier = $sp && $sp->supplier ? $sp->supplier->name : '-';

        // Get category (string only)
        $category = $product && $product->category ? $product->category->name : ($sp && $sp->category ? $sp->category->name : '-');
        $categoryId = $product && $product->category ? $product->category->id : ($sp && $sp->category ? $sp->category->id : null);

        // Get unit
        $unit = $product && $product->unitType ? $product->unitType->sell_unit : 'pcs';

        // Get prices
        $purchasePrice = $product ? $product->purchase_price : null;
        $sellPrice = $product ? $product->sell_price : null;

        // Get description
        $description = $product ? $product->description : null;

        // Get sold/imported counts
        $totalSold = $soldKey && isset($soldByProduct[$soldKey]) ? (int) $soldByProduct[$soldKey]->total_sold : 0;
        $totalImported = $importedKey && isset($importedByProduct[$importedKey]) ? (int) $importedByProduct[$importedKey]->total_imported : 0;

        return [
            'id'                          => $id,
            'raw_id'                      => $inv ? $inv->id : null,
            'product_id'                  => $product ? $product->id : ($inv ? $inv->product_id : null),
            'variant_id'                  => $variant ? $variant->id : null,
            'supplier_product_id'         => $sp ? $sp->id : null,
            'supplier_product_variant_id' => $variant ? $variant->id : null,
            'barcode'                     => $barcode,
            'name'                        => $name,
            'supplier'                    => $supplier,
            'category'                    => $category,
            'category_id'                 => $categoryId,
            'unit'                        => $unit,
            'current_stock'               => $inv ? $inv->current_stock : 0,
            'warehouse_stock'             => $inv ? $inv->warehouse_stock : 0,
            'reorder_threshold'           => $inv ? $inv->reorder_threshold : 10,
            'purchase_price'              => $purchasePrice,
            'sell_price'                  => $sellPrice,
            'description'                 => $description,
            'size'                        => $sizeLabel ?: '-',
            'color'                       => $colorLabel ?: '-',
            'weight'                      => $weightLabel ?: '-',
            'is_variant'                  => $isVariant,
            'is_orphan'                   => $isOrphan,
            'is_base_of_variants'         => $isBaseOfVariants,
            'total_sold'                  => $totalSold,
            'total_imported'              => $totalImported,
        ];
    }
}
