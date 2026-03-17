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
        $po = PurchaseOrder::findOrFail($id);

        if ($po->status !== 'pending') {
            return response()->json(['message' => 'Only pending POs can be declined.', 'status' => 'error'], 422);
        }

        $po->update(['status' => 'cancelled']);

        return response()->json([
            'data'    => $po,
            'message' => 'Purchase order has been declined.',
            'status'  => 'success',
        ]);
    }

    public function accept($id)
    {
        $supplier = request()->user();

        $po = PurchaseOrder::where('supplier_id', $supplier->id)
            ->where('status', 'pending_supplier')
            ->findOrFail($id);

        DB::transaction(function () use ($po) {
            $po->update([
                'status'      => 'accepted',
                'accepted_at' => now(),
            ]);

            // Automatically increment inventory upon acceptance (Direct to Inventory)
            foreach ($po->items as $item) {
                $search = [
                    'product_id'         => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                ];

                if (!$item->product_id) {
                    $search['supplier_product_id'] = $item->supplier_product_id;
                }

                $inv = \App\Models\Inventory::firstOrCreate(
                    $search,
                    [
                        'current_stock'     => 0,
                        'warehouse_stock'   => 0,
                        'reorder_threshold' => 10,
                    ]
                );

                $inv->increment('warehouse_stock', $item->quantity);
                $inv->last_adjusted_at = now();
                $inv->save();
            }
        });

        // Notify Admin(s)
        $admins = User::where('role', 'admin')->get();
        Notification::send($admins, new PurchaseOrderAccepted($po));

        return response()->json([
            'data'    => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order accepted. You can now mark it as delivered when ready.',
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

        $po->update([
            'status'           => 'rejected',
            'rejection_reason' => $data['rejection_reason'],
        ]);

        return response()->json([
            'data'    => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order rejected. The admin has been notified.',
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
                // Determine search criteria for existing inventory
                $search = [
                    'product_id'         => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                ];

                if (!$item->product_id) {
                    $search['supplier_product_id'] = $item->supplier_product_id;
                }

                $inv = Inventory::firstOrCreate(
                    $search,
                    [
                        'current_stock'     => 0,
                        'warehouse_stock'   => 0,
                        'reorder_threshold' => 10,
                    ]
                );

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
