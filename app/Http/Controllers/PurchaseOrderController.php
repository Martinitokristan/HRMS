<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Jobs\ProcessProductBannerImage;
use App\Models\PurchaseOrder;
use App\Models\POItem;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SupplierProduct;
use App\Models\SupplierProductVariant;
use App\Models\User;
use App\Notifications\PurchaseOrderRequest;
use App\Notifications\PurchaseOrderAccepted;
use App\Notifications\PurchaseOrderDelivered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.supplierProduct'])
            ->when($request->tab, function ($q) use ($request) {
                if ($request->tab === 'requests') {
                    return $q->whereIn('status', ['pending', 'pending_supplier', 'accepted']);
                } elseif ($request->tab === 'completed') {
                    return $q->whereIn('status', ['supplier_delivered', 'received', 'rejected', 'cancelled']);
                }
            })
            ->when($request->status, function ($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function ($q) use ($request) {
                return $q->where('po_number', 'like', "%{$request->search}%");
            })
            ->latest();

        return response()->json([
            'data' => $query->paginate($request->get('per_page', 20)),
            'status' => 'success',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.supplier_product_id' => 'nullable|exists:supplier_products,id',
            'items.*.supplier_product_variant_id' => 'nullable|exists:supplier_product_variants,id',
            'items.*.quantity' => 'required|numeric|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'expected_date' => 'nullable|date',
        ]);

        $po = DB::transaction(function () use ($data, $request) {
            $total = 0;
            $po = PurchaseOrder::create([
                'po_number' => 'PO-' . str_pad(PurchaseOrder::count() + 1, 4, '0', STR_PAD_LEFT),
                'supplier_id' => $data['supplier_id'],
                'created_by' => $request->user()->id,
                'is_auto' => false,
                'status' => 'pending',
                'expected_date' => $data['expected_date'] ?? null,
                'total_cost' => 0,
            ]);

            foreach ($data['items'] as $item) {
                $subtotal = $item['quantity'] * $item['unit_cost'];
                $total += $subtotal;
                POItem::create([
                    'purchase_order_id' => $po->id,
                    'product_id' => $item['product_id'] ?? null,
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'supplier_product_id' => $item['supplier_product_id'] ?? null,
                    'supplier_product_variant_id' => $item['supplier_product_variant_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'subtotal' => $subtotal,
                ]);

                // CRITICAL FIX: Reserve/decrease supplier stock when admin ORDERS
                if (!empty($item['supplier_product_id'])) {
                    $supplierProduct = \App\Models\SupplierProduct::with('variants')->find($item['supplier_product_id']);
                    if ($supplierProduct) {
                        if (!empty($item['supplier_product_variant_id'])) {
                            // PATH A: Decrease specific variant stock (variant's own stock, independent of base)
                            $supplierVariant = \App\Models\SupplierProductVariant::find($item['supplier_product_variant_id']);
                            if (!$supplierVariant) {
                                throw new \Exception("Variant not found.");
                            }
                            if ($supplierVariant->stock < $item['quantity']) {
                                throw new \Exception("Insufficient stock for variant '{$supplierVariant->size}{$supplierVariant->color}{$supplierVariant->weight}'. Available: {$supplierVariant->stock}, Requested: {$item['quantity']}");
                            }
                            $supplierVariant->decrement('stock', $item['quantity']);
                            // NOTE: We do NOT sync total_stock here — base stock is independent from variant stocks.
                        } else {
                            // PATH B: No variant selected = ordering the Regular/base product
                            // Deduct from total_stock (the base product's own stock)
                            if ($supplierProduct->total_stock < $item['quantity']) {
                                throw new \Exception("Insufficient stock for '{$supplierProduct->name}' (Regular). Available: {$supplierProduct->total_stock}, Requested: {$item['quantity']}");
                            }
                            $supplierProduct->decrement('total_stock', $item['quantity']);
                        }
                    }
                }
            }

            $po->update(['total_cost' => $total]);
            return $po;
        });

        // Notification moved to approve() method

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.created'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.created'));

        return response()->json([
            'data' => $po->load(['supplier', 'items.product', 'items.supplierProduct']),
            'message' => 'Order request sent successfully',
            'status' => 'success',
        ], 201);
    }

    public function show($id)
    {
        $po = PurchaseOrder::with([
            'supplier',
            'creator',
            'items.product',
            'items.supplierProduct',
            'items.productVariant.sizeValue',
            'items.productVariant.colorValue',
            'items.productVariant.weightValue',
        ])->findOrFail($id);
        return response()->json(['data' => $po, 'status' => 'success']);
    }

    public function approve($id)
    {
        $po = PurchaseOrder::findOrFail($id);

        if ($po->status !== 'pending') {
            return response()->json(['message' => 'Only pending POs can be approved.', 'status' => 'error'], 422);
        }

        $po->update(['status' => 'pending_supplier']);

        // Notify Supplier
        $po->load(['supplier', 'items.product', 'items.supplierProduct']);
        if ($po->supplier) {
            $po->supplier->notify(new \App\Notifications\PurchaseOrderRequest($po));
        }

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.approved'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_notifications', 'supplier_products'], 'purchase_order.approved'));

        return response()->json([
            'data' => $po,
            'message' => 'Purchase order approved and sent to supplier.',
            'status' => 'success',
        ]);
    }

    public function decline($id)
    {
        $po = PurchaseOrder::with('items')->findOrFail($id);

        if ($po->status !== 'pending') {
            return response()->json(['message' => 'Only pending POs can be declined.', 'status' => 'error'], 422);
        }

        DB::transaction(function () use ($po) {
            // CRITICAL FIX: Restore supplier stock when admin cancels order
            foreach ($po->items as $item) {
                if ($item->supplier_product_id) {
                    $supplierProduct = \App\Models\SupplierProduct::find($item->supplier_product_id);
                    if ($supplierProduct) {
                        if ($item->supplier_product_variant_id) {
                            // Restore variant stock
                            $supplierVariant = \App\Models\SupplierProductVariant::find($item->supplier_product_variant_id);
                            if ($supplierVariant) {
                                $supplierVariant->increment('stock', $item->quantity);

                                // Sync total_stock atomically to prevent race conditions
                                $supplierProduct->increment('total_stock', $item->quantity);
                            }
                        } else {
                            // Restore base product stock
                            $supplierProduct->increment('total_stock', $item->quantity);
                        }
                    }
                }
            }

            $po->update(['status' => 'cancelled']);
        });

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.declined'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.declined'));

        return response()->json([
            'data' => $po,
            'message' => 'Purchase order has been declined. Stock has been restored.',
            'status' => 'success',
        ]);
    }

    public function accept($id)
    {
        $supplierId = $this->resolveSupplierID(request());

        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'pending_supplier')
            ->findOrFail($id);

        $po->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        // Notify Admin(s)
        $admins = User::where('role', 'admin')->get();
        Notification::send($admins, new PurchaseOrderAccepted($po));

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.accepted'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.accepted'));

        return response()->json([
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order accepted. Awaiting delivery confirmation.',
            'status' => 'success',
        ]);
    }

    public function reject($id)
    {
        $supplierId = $this->resolveSupplierID(request());

        $data = request()->validate([
            'rejection_reason' => 'required|string|min:10|max:1000',
        ]);

        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'pending_supplier')
            ->findOrFail($id);

        DB::transaction(function () use ($po, $data) {
            // CRITICAL FIX: Restore supplier stock when order is rejected
            foreach ($po->items as $item) {
                if ($item->supplier_product_id) {
                    $supplierProduct = \App\Models\SupplierProduct::find($item->supplier_product_id);
                    if ($supplierProduct) {
                        if ($item->supplier_product_variant_id) {
                            // Restore variant stock
                            $supplierVariant = \App\Models\SupplierProductVariant::find($item->supplier_product_variant_id);
                            if ($supplierVariant) {
                                $supplierVariant->increment('stock', $item->quantity);

                                // Sync total_stock atomically to prevent race conditions
                                $supplierProduct->increment('total_stock', $item->quantity);
                            }
                        } else {
                            // Restore base product stock
                            $supplierProduct->increment('total_stock', $item->quantity);
                        }
                    }
                }
            }

            $po->update([
                'status' => 'rejected',
                'rejection_reason' => $data['rejection_reason'],
            ]);
        });

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.rejected'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.rejected'));

        return response()->json([
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order rejected. Stock has been restored.',
            'status' => 'success',
        ]);
    }

    public function markReceived($id)
    {
        $po = PurchaseOrder::with([
            'items.supplierProduct',
            'items.supplierProductVariant',
        ])->findOrFail($id);

        if ($po->status !== 'supplier_delivered') {
            return response()->json([
                'message' => 'Only delivered POs can be marked as received.',
                'status' => 'error',
            ], 422);
        }

        // ----------------------------------------------------------------
        // PRE-FETCH PHASE (outside the transaction)
        // Collect all IDs we will need so we can batch-load data and
        // generate barcodes without holding any row locks.
        // ----------------------------------------------------------------

        $supplierProductIds        = $po->items->pluck('supplier_product_id')->filter()->unique()->values();
        $supplierProductVariantIds = $po->items->pluck('supplier_product_variant_id')->filter()->unique()->values();
        $productIds                = $po->items->pluck('product_id')->filter()->unique()->values();
        $productVariantIds         = $po->items->pluck('product_variant_id')->filter()->unique()->values();

        // Eager-load supplier variants (already on the relation, but index by id for O(1) access)
        $supplierVariantsById = SupplierProductVariant::whereIn('id', $supplierProductVariantIds)
            ->get()->keyBy('id');

        // Eager-load supplier products
        $supplierProductsById = SupplierProduct::whereIn('id', $supplierProductIds)
            ->get()->keyBy('id');

        // Batch-load existing inventory records that might match any of our items.
        // We load by every possible lookup key so we can resolve them in PHP.
        $existingInventories = Inventory::where(function ($q) use (
            $productIds, $productVariantIds, $supplierProductIds, $supplierProductVariantIds
        ) {
            $q->whereIn('product_id', $productIds->merge($productIds)->unique())
              ->orWhereIn('product_variant_id', $productVariantIds)
              ->orWhereIn('supplier_product_id', $supplierProductIds)
              ->orWhereIn('supplier_product_variant_id', $supplierProductVariantIds);
        })->get();

        // Build lookup maps for O(1) resolution inside the loop
        $invByVariant         = $existingInventories->whereNotNull('product_variant_id')->keyBy('product_variant_id');
        $invBySupplierVariant = $existingInventories->whereNotNull('supplier_product_variant_id')->keyBy('supplier_product_variant_id');
        $invBySupplierProduct = $existingInventories->whereNull('supplier_product_variant_id')
                                                    ->whereNotNull('supplier_product_id')
                                                    ->keyBy('supplier_product_id');
        // Base-product inventory: keyed by product_id (variant_id is null)
        $invByProduct = $existingInventories->whereNull('product_variant_id')
                                            ->whereNotNull('product_id')
                                            ->keyBy('product_id');

        // Pre-load existing variant_values to avoid per-row lookups inside the transaction
        $variantValuesByLabelCategory = DB::table('variant_values')
            ->whereIn('category', ['size', 'color', 'weight'])
            ->get()
            ->groupBy(fn($r) => $r->category . '|' . $r->label)
            ->map(fn($g) => $g->first());

        // Determine which supplier barcodes are already taken so we can skip them
        $takenBarcodes = Product::pluck('barcode')
            ->merge(ProductVariant::pluck('barcode'))
            ->filter()
            ->flip(); // use as a hash-set

        // Generate a unique barcode without hitting the DB in a loop
        $generateUniqueBarcode = function (string $prefix = 'BARCODE-') use (&$takenBarcodes): string {
            do {
                $barcode = $prefix . strtoupper(Str::random(10));
            } while (isset($takenBarcodes[$barcode]));

            // Reserve it immediately so subsequent calls in the same request don't collide
            $takenBarcodes[$barcode] = true;

            return $barcode;
        };

        // Per-request product cache: supplier_product_id => internal product_id
        $productCache = [];

        // ----------------------------------------------------------------
        // TRANSACTION PHASE
        // Focused exclusively on data mutations with pessimistic locking
        // on inventory rows to prevent concurrent-request races.
        // ----------------------------------------------------------------

        DB::transaction(function () use (
            $po,
            $supplierVariantsById,
            $supplierProductsById,
            $invByVariant,
            $invBySupplierVariant,
            $invBySupplierProduct,
            $invByProduct,
            $variantValuesByLabelCategory,
            $generateUniqueBarcode,
            &$productCache
        ) {
            foreach ($po->items as $item) {
                $inv = null;

                // ----------------------------------------------------------
                // STEP 1: Resolve existing inventory record (single pass)
                // Priority: product_variant_id > supplier_product_variant_id
                //           > supplier_product_id (base) > product_id (base)
                // ----------------------------------------------------------

                if (!is_null($item->product_variant_id)) {
                    $inv = $invByVariant->get($item->product_variant_id);
                }

                if (!$inv && !is_null($item->supplier_product_variant_id)) {
                    $inv = $invBySupplierVariant->get($item->supplier_product_variant_id);
                }

                if (!$inv && is_null($item->product_variant_id) && is_null($item->supplier_product_variant_id)) {
                    // Base product: try supplier_product_id first, then product_id
                    if (!is_null($item->supplier_product_id)) {
                        $inv = $invBySupplierProduct->get($item->supplier_product_id);
                    }
                    if (!$inv && !is_null($item->product_id)) {
                        $inv = $invByProduct->get($item->product_id);
                    }
                }

                // If we found an inventory record, lock it for update to prevent
                // concurrent requests from double-incrementing the same row.
                if ($inv) {
                    $inv = Inventory::where('id', $inv->id)->lockForUpdate()->first();
                }

                // ----------------------------------------------------------
                // STEP 2: Create missing product / variant / inventory
                // ----------------------------------------------------------

                if (!$inv || (is_null($inv->product_id) && $item->supplier_product_id)) {
                    $productId = $item->product_id
                        ?? ($productCache[$item->supplier_product_id] ?? null);

                    // Find or create the internal Product from the supplier product
                    if (!$productId && $item->supplier_product_id) {
                        $supplierProduct = $supplierProductsById->get($item->supplier_product_id);

                        if ($supplierProduct) {
                            // Check if a product is already linked via inventory
                            $linkedProduct = Product::whereHas('inventory', function ($q) use ($item) {
                                $q->where('supplier_product_id', $item->supplier_product_id);
                            })->first();

                            if ($linkedProduct) {
                                $productId = $linkedProduct->id;
                            } else {
                                $barcode = (!empty($supplierProduct->barcode) && $supplierProduct->barcode !== 'undefined')
                                    ? $supplierProduct->barcode
                                    : $generateUniqueBarcode();

                                $newProduct = Product::updateOrCreate(
                                    ['barcode' => $barcode],
                                    [
                                        'name'          => $supplierProduct->name,
                                        'description'   => $supplierProduct->description,
                                        'category_id'   => $supplierProduct->category_id,
                                        'brand_id'      => $supplierProduct->brand_id,
                                        'unit_type_id'  => 1,
                                        'supplier_id'   => $supplierProduct->supplier_id ?? 1,
                                        'purchase_price' => $supplierProduct->price,
                                        'sell_price'    => $supplierProduct->price * 1.3,
                                        'image_path'    => $supplierProduct->image_path,
                                        'is_active'     => 0,
                                    ]
                                );
                                $productId = $newProduct->id;

                                if (!empty($newProduct->image_path) && empty($newProduct->image_banner_path)) {
                                    ProcessProductBannerImage::dispatch($newProduct->id, $newProduct->image_path);
                                }
                            }

                            $productCache[$item->supplier_product_id] = $productId;
                        }
                    }

                    $variantId = $item->product_variant_id;

                    // Find or create the internal ProductVariant from the supplier variant
                    if (!$variantId && $item->supplier_product_variant_id && $productId) {
                        $spVariant = $supplierVariantsById->get($item->supplier_product_variant_id);

                        if ($spVariant) {
                            // Try to match an existing variant by its value labels
                            $existingVariant = ProductVariant::where('product_id', $productId)
                                ->where(function ($q) use ($spVariant) {
                                    $spVariant->size
                                        ? $q->whereHas('sizeValue', fn($sq) => $sq->where('label', $spVariant->size))
                                        : $q->whereNull('size_value_id');
                                })
                                ->where(function ($q) use ($spVariant) {
                                    $spVariant->color
                                        ? $q->whereHas('colorValue', fn($sq) => $sq->where('label', $spVariant->color))
                                        : $q->whereNull('color_value_id');
                                })
                                ->where(function ($q) use ($spVariant) {
                                    $spVariant->weight
                                        ? $q->whereHas('weightValue', fn($sq) => $sq->where('label', $spVariant->weight))
                                        : $q->whereNull('weight_value_id');
                                })
                                ->lockForUpdate()
                                ->first();

                            if ($existingVariant) {
                                $variantId = $existingVariant->id;
                            } else {
                                // Resolve variant value IDs from the pre-fetched map
                                $sizeValueId   = $spVariant->size
                                    ? optional($variantValuesByLabelCategory->get('size|' . $spVariant->size))->id
                                      ?? DB::table('variant_values')->insertGetId([
                                          'variant_id' => 1, 'label' => $spVariant->size,
                                          'category' => 'size', 'created_at' => now(), 'updated_at' => now(),
                                      ])
                                    : null;

                                $colorValueId  = $spVariant->color
                                    ? optional($variantValuesByLabelCategory->get('color|' . $spVariant->color))->id
                                      ?? DB::table('variant_values')->insertGetId([
                                          'variant_id' => 2, 'label' => $spVariant->color,
                                          'category' => 'color', 'created_at' => now(), 'updated_at' => now(),
                                      ])
                                    : null;

                                $weightValueId = $spVariant->weight
                                    ? optional($variantValuesByLabelCategory->get('weight|' . $spVariant->weight))->id
                                      ?? DB::table('variant_values')->insertGetId([
                                          'variant_id' => 3, 'label' => $spVariant->weight,
                                          'category' => 'weight', 'created_at' => now(), 'updated_at' => now(),
                                      ])
                                    : null;

                                $newVariant = ProductVariant::create([
                                    'product_id'       => $productId,
                                    'size_value_id'    => $sizeValueId,
                                    'color_value_id'   => $colorValueId,
                                    'weight_value_id'  => $weightValueId,
                                    'stock'            => 0,
                                    'price_override'   => $spVariant->price_override,
                                    'barcode'          => $generateUniqueBarcode('VAR-'),
                                    'sale_percentage'  => 0,
                                    'image_path'       => $spVariant->image_path,
                                    'additional_images' => $spVariant->additional_images,
                                ]);
                                $variantId = $newVariant->id;
                            }
                        }
                    }

                    if ($inv) {
                        // Link an orphaned inventory record to the resolved product/variant
                        $inv->product_id = $productId;
                        if ($variantId) {
                            $inv->product_variant_id = $variantId;
                        }
                        $inv->save();
                    } else {
                        // Create a brand-new inventory record, using firstOrCreate to guard
                        // against a concurrent request that may have just inserted the same row.
                        $inv = Inventory::firstOrCreate(
                            array_filter([
                                'product_id'                  => $productId,
                                'product_variant_id'          => $variantId,
                                'supplier_product_id'         => $item->supplier_product_id,
                                'supplier_product_variant_id' => $item->supplier_product_variant_id,
                            ], fn($v) => !is_null($v)),
                            [
                                'current_stock'    => 0,
                                'warehouse_stock'  => 0,
                                'reorder_threshold' => 10,
                            ]
                        );
                    }

                    // Keep the PO item in sync with the resolved product/variant IDs
                    $item->update([
                        'product_id'         => $productId,
                        'product_variant_id' => $variantId,
                    ]);
                }

                // ----------------------------------------------------------
                // STEP 3: Increment warehouse stock atomically
                // ----------------------------------------------------------
                $inv->increment('warehouse_stock', $item->quantity);
                $inv->update(['last_adjusted_at' => now()]);
            }

            $po->update(['status' => 'received']);
        });

        if (Cache::getStore() instanceof \Illuminate\Cache\TaggableStore) {
            Cache::tags(['inventory', 'products'])->flush();
        }

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_inventory', 'admin_dashboard', 'supplier_products'], 'purchase_order.received'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.received'));

        return response()->json([
            'data'    => $po->fresh()->load(['supplier', 'items.product', 'items.productVariant']),
            'message' => 'Purchase order received. Stock added to Warehouse inventory.',
            'status'  => 'success',
        ]);
    }



    // Supplier-specific methods

    /**
     * Resolve the suppliers.id for the currently authenticated user.
     * Supplier users log in via the shared /api/login endpoint (users table),
     * but purchase_orders.supplier_id references suppliers.id.
     * The two tables are linked by email.
     */
    private function resolveSupplierID(Request $request): int
    {
        $user = $request->user();
        // If authenticated as Supplier model directly (token auth), use id as-is
        if ($user instanceof \App\Models\Supplier) {
            return $user->id;
        }
        // Otherwise authenticated as User model — find linked Supplier by email
        $supplier = \App\Models\Supplier::where('email', $user->email)->first();
        if (!$supplier) {
            abort(403, 'No supplier account linked to this user.');
        }
        return $supplier->id;
    }

    public function supplierIndex(Request $request)
    {
        try {
            $supplier = $request->user();

            \Log::info('SupplierIndex: Building query', ['supplier_id' => $supplier->id]);

            $supplierId = $this->resolveSupplierID($request);

            $query = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.supplierProduct'])
                ->where('supplier_id', $supplierId)
                ->when($request->tab, function ($q) use ($request) {
                    if ($request->tab === 'requests') {
                        return $q->whereIn('status', ['pending_supplier', 'accepted']);
                    } elseif ($request->tab === 'completed') {
                        return $q->whereIn('status', ['supplier_delivered', 'received', 'rejected', 'cancelled']);
                    }
                })
                ->when($request->status, function ($q) use ($request) {
                    return $q->where('status', $request->status);
                })
                ->latest();

            \Log::info('SupplierIndex: Executing query', []);
            $result = $query->paginate($request->get('per_page', 20));
            \Log::info('SupplierIndex: Query successful', ['count' => $result->count()]);

            return response()->json([
                'data' => $result,
                'status' => 'success',
            ]);
        } catch (\Exception $e) {
            \Log::error('SupplierIndex error', ['message' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine(), 'trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => 'Server error: ' . $e->getMessage(),
                'status' => 'error'
            ], 500);
        }
    }

    public function supplierShow($id)
    {
        $supplierId = $this->resolveSupplierID(request());

        $po = PurchaseOrder::with(['supplier', 'creator', 'items.product'])
            ->where('supplier_id', $supplierId)
            ->findOrFail($id);

        return response()->json(['data' => $po, 'status' => 'success']);
    }

    public function deliver($id)
    {
        $supplierId = $this->resolveSupplierID(request());

        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'accepted')
            ->findOrFail($id);

        $data = request()->validate([
            'delivery_notes' => 'nullable|string|max:500',
        ]);

        $po->update([
            'status' => 'supplier_delivered',
            'delivered_at' => now(),
            'delivered_by' => $supplierId,
            'delivery_notes' => $data['delivery_notes'] ?? null,
        ]);

        // Notify Admin(s)
        $admins = \App\Models\User::where('role', 'admin')->get();
        \Illuminate\Support\Facades\Notification::send($admins, new \App\Notifications\PurchaseOrderDelivered($po));

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'admin_notifications'], 'purchase_order.delivered'));
        broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_orders', 'supplier_dashboard'], 'purchase_order.delivered'));

        return response()->json([
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order marked as delivered',
            'status' => 'success',
        ]);
    }

    public function revenueReport(Request $request)
    {
        $supplierId = $this->resolveSupplierID($request);
        $period = $request->get('period', 'year');
        $yearParam = $request->get('year', now()->year);
        $monthParam = $request->get('month'); // 1-12

        $query = PurchaseOrder::where('supplier_id', $supplierId)
            ->whereIn('status', ['accepted', 'supplier_delivered', 'received']);

        $isYearlyView = ($period === 'year' || empty($monthParam));

        if ($isYearlyView) {
            $from = now()->setYear($yearParam)->startOfYear();
            $to = now()->setYear($yearParam)->endOfYear();

            $data = $query->whereBetween('created_at', [$from, $to])
                ->select(
                    DB::raw('MONTH(created_at) as label_num'),
                    DB::raw('SUM(total_cost) as value')
                )
                ->groupBy('label_num')
                ->orderBy('label_num')
                ->get();

            $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            $formatted = [];
            for ($i = 1; $i <= 12; $i++) {
                $found = $data->firstWhere('label_num', $i);
                $formatted[] = [
                    'label' => $months[$i - 1],
                    'value' => $found ? (float)$found->value : 0
                ];
            }
        } else {
            $from = now()->setYear($yearParam)->setMonth($monthParam)->startOfMonth();
            $to = (clone $from)->endOfMonth();

            $data = $query->whereBetween('created_at', [$from, $to])
                ->select(
                    DB::raw('DAY(created_at) as label_num'),
                    DB::raw('SUM(total_cost) as value')
                )
                ->groupBy('label_num')
                ->orderBy('label_num')
                ->get();

            $formatted = [];
            $daysInMonth = $from->daysInMonth;
            for ($i = 1; $i <= $daysInMonth; $i++) {
                $found = $data->firstWhere('label_num', $i);
                $formatted[] = [
                    'label' => (string)$i,
                    'value' => $found ? (float)$found->value : 0
                ];
            }
        }

        return response()->json([
            'data' => $formatted,
            'status' => 'success'
        ]);
    }
}
