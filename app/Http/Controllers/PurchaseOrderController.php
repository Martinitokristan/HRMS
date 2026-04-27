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
use App\Models\User;
use App\Notifications\PurchaseOrderRequest;
use App\Notifications\PurchaseOrderAccepted;
use App\Notifications\PurchaseOrderDelivered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.supplierProduct', 'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue'])
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
        try {
            $po = PurchaseOrder::with('items')->findOrFail($id);

            if ($po->status !== 'supplier_delivered') {
                throw new \Exception('Only delivered POs can be marked as received.', 422);
            }

            // PHASE 1: PRE-FETCH (Outside transaction)
            // Collect all unique supplier product IDs and variant IDs
            $supplierProductIds = $po->items->pluck('supplier_product_id')->filter()->unique()->toArray();
            $supplierVariantIds = $po->items->pluck('supplier_product_variant_id')->filter()->unique()->toArray();

            // Fetch existing data to minimize DB queries in the loop
            $existingSupplierProducts = \App\Models\SupplierProduct::whereIn('id', $supplierProductIds)->get()->keyBy('id');
            $existingSupplierVariants = \App\Models\SupplierProductVariant::whereIn('id', $supplierVariantIds)->get()->keyBy('id');

            // Pre-fetch related existing Products mapped by supplier_product_id
            $existingProducts = \App\Models\Product::whereIn('supplier_id', function($q) use ($supplierProductIds) {
                $q->select('supplier_id')->from('supplier_products')->whereIn('id', $supplierProductIds);
            })->get();

            $generateUniqueBarcode = function ($prefix = 'BARCODE-') {
                return $prefix . strtoupper(\Illuminate\Support\Str::random(10));
            };

            // PHASE 2: TRANSACTION (Focused mutations only)
            $po = DB::transaction(function () use ($id, $po, $existingSupplierProducts, $existingSupplierVariants, $generateUniqueBarcode) {
                // Lock only this PO row to prevent concurrent markReceived calls
                $po = PurchaseOrder::with('items')->where('id', $id)->lockForUpdate()->firstOrFail();
                
                if ($po->status !== 'supplier_delivered') {
                    throw new \Exception('Only delivered POs can be marked as received.', 422);
                }

                static $productLocalCache = [];

                foreach ($po->items as $item) {
                    $inv = null;
                    $supplierProductId = $item->supplier_product_id;

                    // CASE 1: Base Product Inventory Lookup
                    if (is_null($item->product_variant_id) && is_null($item->supplier_product_variant_id)) {
                        $inv = Inventory::where('product_id', $item->product_id)
                            ->whereNull('product_variant_id')
                            ->lockForUpdate()
                            ->first();
                    }
                    // CASE 2: Variant Inventory Lookup
                    else {
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

                    // CASE 4: Create Products/Variants if Missing
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
                        $oldStock = $inv->warehouse_stock;
                        $inv->increment('warehouse_stock', $item->quantity);
                        $inv->last_adjusted_at = now();
                        $inv->save();

                        $item->update([
                            'product_id' => $inv->product_id,
                            'product_variant_id' => $inv->product_variant_id,
                        ]);

                        \App\Models\InventoryAdjustment::create([
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

            return response()->json([
                'data' => $po->fresh()->load(['supplier', 'items.product', 'items.productVariant']),
                'message' => 'Purchase order received. Stock added to Warehouse inventory.',
                'status' => 'success',
            ]);

        } catch (\Exception $e) {
            \Log::error('Error marking PO as received: ' . $e->getMessage(), [
                'id' => $id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => $e->getMessage(),
                'status' => 'error',
            ], $e->getCode() ?: 500);
        }
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

            $query = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.supplierProduct', 'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue'])
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

        $po = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue'])
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
