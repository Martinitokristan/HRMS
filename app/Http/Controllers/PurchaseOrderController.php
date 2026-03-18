<?php

namespace App\Http\Controllers;

use App\Models\PurchaseOrder;
use App\Models\POItem;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SupplierProduct;
use App\Models\User;
use App\Notifications\PurchaseOrderRequest;
use App\Notifications\PurchaseOrderAccepted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.supplierProduct'])
            ->when($request->status, function($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function($q) use ($request) {
                return $q->where('po_number', 'like', "%{$request->search}%");
            })
            ->latest();

        return response()->json([
            'data'   => $query->paginate($request->get('per_page', 15)),
            'status' => 'success',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id'                    => 'required|exists:suppliers,id',
            'items'                          => 'required|array|min:1',
            'items.*.product_id'             => 'nullable|exists:products,id',
            'items.*.product_variant_id'     => 'nullable|exists:product_variants,id',
            'items.*.supplier_product_id'    => 'nullable|exists:supplier_products,id',
            'items.*.supplier_product_variant_id' => 'nullable|exists:supplier_product_variants,id',
            'items.*.quantity'               => 'required|numeric|min:1',
            'items.*.unit_cost'              => 'required|numeric|min:0',
            'expected_date'                  => 'nullable|date',
        ]);

        $po = DB::transaction(function () use ($data, $request) {
            $total = 0;
            $po = PurchaseOrder::create([
                'po_number'     => 'PO-' . str_pad(PurchaseOrder::count() + 1, 4, '0', STR_PAD_LEFT),
                'supplier_id'   => $data['supplier_id'],
                'created_by'    => $request->user()->id,
                'is_auto'       => false,
                'status'        => 'pending',
                'expected_date' => $data['expected_date'] ?? null,
                'total_cost'    => 0,
            ]);

            foreach ($data['items'] as $item) {
                $subtotal = $item['quantity'] * $item['unit_cost'];
                $total += $subtotal;
                POItem::create([
                    'purchase_order_id'           => $po->id,
                    'product_id'                  => $item['product_id'] ?? null,
                    'product_variant_id'          => $item['product_variant_id'] ?? null,
                    'supplier_product_id'         => $item['supplier_product_id'] ?? null,
                    'supplier_product_variant_id' => $item['supplier_product_variant_id'] ?? null,
                    'quantity'                    => $item['quantity'],
                    'unit_cost'                   => $item['unit_cost'],
                    'subtotal'                    => $subtotal,
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

        // Notify Supplier
        if ($po->supplier) {
            $po->supplier->notify(new PurchaseOrderRequest($po));
        }

        return response()->json([
            'data'    => $po->load(['supplier', 'items.product', 'items.supplierProduct']),
            'message' => 'Order request sent successfully',
            'status'  => 'success',
        ], 201);
    }

    public function show($id)
    {
        $po = PurchaseOrder::with([
            'supplier', 'creator',
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

        return response()->json([
            'data'    => $po,
            'message' => 'Purchase order approved and sent to supplier.',
            'status'  => 'success',
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
                                
                                // Sync total_stock
                                $totalVariantStock = \App\Models\SupplierProductVariant::where('supplier_product_id', $supplierProduct->id)->sum('stock');
                                $supplierProduct->update(['total_stock' => $totalVariantStock]);
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

        return response()->json([
            'data'    => $po,
            'message' => 'Purchase order has been declined. Stock has been restored.',
            'status'  => 'success',
        ]);
    }

    public function accept($id)
    {
        $supplier = request()->user();

        $po = PurchaseOrder::where('supplier_id', $supplier->id)
            ->where('status', 'pending_supplier')
            ->findOrFail($id);

        $po->update([
            'status'      => 'accepted',
            'accepted_at' => now(),
        ]);

        // Notify Admin(s)
        $admins = User::where('role', 'admin')->get();
        Notification::send($admins, new PurchaseOrderAccepted($po));

        return response()->json([
            'data'    => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order accepted. Awaiting delivery confirmation.',
            'status'  => 'success',
        ]);
    }

    public function reject($id)
    {
        $supplier = request()->user();

        $data = request()->validate([
            'rejection_reason' => 'required|string|min:10|max:1000',
        ]);

        $po = PurchaseOrder::where('supplier_id', $supplier->id)
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
                                
                                // Sync total_stock
                                $totalVariantStock = \App\Models\SupplierProductVariant::where('supplier_product_id', $supplierProduct->id)->sum('stock');
                                $supplierProduct->update(['total_stock' => $totalVariantStock]);
                            }
                        } else {
                            // Restore base product stock
                            $supplierProduct->increment('total_stock', $item->quantity);
                        }
                    }
                }
            }

            $po->update([
                'status'           => 'rejected',
                'rejection_reason' => $data['rejection_reason'],
            ]);
        });

        return response()->json([
            'data'    => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order rejected. Stock has been restored.',
            'status'  => 'success',
        ]);
    }

    public function markReceived($id)
    {
        $po = PurchaseOrder::with('items')->findOrFail($id);

        if ($po->status !== 'supplier_delivered') {
            return response()->json([
                'message' => 'Only delivered POs can be marked as received.',
                'status'  => 'error',
            ], 422);
        }

        DB::transaction(function () use ($po) {
            foreach ($po->items as $item) {
                $inv = null;

                // CASE 1: Item has supplier_product_variant_id - check if it's already linked to an existing inventory
                if ($item->supplier_product_variant_id) {
                    $inv = Inventory::where('supplier_product_variant_id', $item->supplier_product_variant_id)->first();
                }

                // CASE 2: If no existing inventory found via supplier variant, check by product + variant
                if (!$inv && $item->product_id) {
                    $inv = Inventory::where('product_id', $item->product_id)
                        ->where('product_variant_id', $item->product_variant_id)
                        ->first();
                }

                // CASE 3: If still no inventory found and it's a supplier product (orphan), check by supplier_product_id
                if (!$inv && $item->supplier_product_id) {
                    // For base products, look for inventory with supplier_product_id and no variant
                    if (!$item->supplier_product_variant_id) {
                        $inv = Inventory::where('supplier_product_id', $item->supplier_product_id)
                            ->whereNull('supplier_product_variant_id')
                            ->first();
                    }
                    // For variants, look for inventory with supplier_product_variant_id
                    else {
                        $inv = Inventory::where('supplier_product_variant_id', $item->supplier_product_variant_id)->first();
                    }
                }

                // CASE 4: Create new inventory if none exists
                if (!$inv) {
                    $inv = Inventory::create([
                        'product_id'                  => $item->product_id,
                        'product_variant_id'          => $item->product_variant_id,
                        'supplier_product_id'         => $item->supplier_product_id,
                        'supplier_product_variant_id' => $item->supplier_product_variant_id,
                        'current_stock'               => 0,
                        'warehouse_stock'             => 0,
                        'reorder_threshold'           => 10,
                    ]);
                }

                $inv->increment('warehouse_stock', $item->quantity);
                $inv->last_adjusted_at = now();
                $inv->save();
            }
            $po->update(['status' => 'received']);
        });

        return response()->json([
            'data'    => $po->fresh()->load(['supplier', 'items.product', 'items.productVariant']),
            'message' => 'Purchase order received. Stock added to Warehouse inventory.',
            'status'  => 'success',
        ]);
    }

    // Supplier-specific methods
    public function supplierIndex(Request $request)
    {
        try {
            $supplier = $request->user();
            
            \Log::info('SupplierIndex: Building query', ['supplier_id' => $supplier->id]);

            $query = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.supplierProduct'])
                ->where('supplier_id', $supplier->id)
                ->when($request->status, function($q) use ($request) {
                    return $q->where('status', $request->status);
                })
                ->latest();

            \Log::info('SupplierIndex: Executing query');
            $result = $query->paginate($request->get('per_page', 15));
            \Log::info('SupplierIndex: Query successful', ['count' => $result->count()]);

            return response()->json([
                'data'   => $result,
                'status' => 'success',
            ]);
        } catch (\Exception $e) {
            \Log::error('SupplierIndex error: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Server error: ' . $e->getMessage(),
                'status' => 'error'
            ], 500);
        }
    }

    public function supplierShow($id)
    {
        $supplier = request()->user();

        $po = PurchaseOrder::with(['supplier', 'creator', 'items.product'])
            ->where('supplier_id', $supplier->id)
            ->findOrFail($id);

        return response()->json(['data' => $po, 'status' => 'success']);
    }

    public function deliver($id)
    {
        $supplier = request()->user();

        $po = PurchaseOrder::where('supplier_id', $supplier->id)
            ->where('status', 'accepted')
            ->findOrFail($id);

        $data = request()->validate([
            'delivery_notes' => 'nullable|string|max:500',
        ]);

        $po->update([
            'status' => 'supplier_delivered',
            'delivered_at' => now(),
            'delivered_by' => $supplier->id,
            'delivery_notes' => $data['delivery_notes'] ?? null,
        ]);

        // TODO: Send notification to admin

        return response()->json([
            'data'    => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order marked as delivered',
            'status'  => 'success',
        ]);
    }
}
