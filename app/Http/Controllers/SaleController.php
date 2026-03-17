<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\Inventory;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    public function index(Request $request)
    {
        $query = Sale::with(['customer', 'items.product', 'delivery'])
            ->when($request->status, function($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function($q) use ($request) {
                return $q->where('order_number', 'like', "%{$request->search}%")
                    ->orWhereHas('customer', function($cq) use ($request) {
                        return $cq->where('name', 'like', "%{$request->search}%");
                    });
            })
            ->when($request->from, function($q) use ($request) {
                return $q->whereDate('created_at', '>=', $request->from);
            })
            ->when($request->to, function($q) use ($request) {
                return $q->whereDate('created_at', '<=', $request->to);
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
            'customer_id'    => 'required|exists:users,id',
            'items'          => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.quantity'   => 'required|numeric|min:1',
            'items.*.price'      => 'nullable|numeric|min:0',
            'items.*.variants'   => 'nullable|array',
            'payment_method'     => 'required|in:cod,cash,gcash,bank_transfer',
            'discount_pct'   => 'nullable|numeric|between:0,100',
            'notes'          => 'nullable|string',
            'address'        => 'nullable|string',
        ]);

        // --- Stock validation before processing ---
        foreach ($data['items'] as $item) {
            $product = \App\Models\Product::findOrFail($item['product_id']);
            if (!empty($item['product_variant_id'])) {
                $variant = \App\Models\ProductVariant::find($item['product_variant_id']);
                if (!$variant || $variant->stock < $item['quantity']) {
                    return response()->json([
                        'message' => "Insufficient stock for {$product->name}" . ($variant ? " (variant)" : "") . ". Available: " . ($variant->stock ?? 0),
                        'status' => 'error',
                    ], 422);
                }
            } else {
                $inv = Inventory::where('product_id', $item['product_id'])->first();
                $available = $inv ? $inv->current_stock : 0;
                if ($available < $item['quantity']) {
                    return response()->json([
                        'message' => "Insufficient stock for {$product->name}. Available: {$available}",
                        'status' => 'error',
                    ], 422);
                }
            }
        }

        $sale = DB::transaction(function () use ($data, $request) {
            $subtotal = 0;
            $itemsData = [];

            foreach ($data['items'] as $item) {
                $product = \App\Models\Product::findOrFail($item['product_id']);
                
                // Use provided price (from cart), or fall back to product price
                $unitPrice = $item['price'] ?? $product->sell_price;
                $lineTotal = $item['quantity'] * $unitPrice;
                $subtotal += $lineTotal;
                
                $itemsData[] = [
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity'   => $item['quantity'],
                    'unit_price' => $unitPrice,
                    'subtotal'   => $lineTotal,
                    'variants'   => $item['variants'] ?? null,
                ];

                // Deduct stock
                if (!empty($item['product_variant_id'])) {
                    $variant = \App\Models\ProductVariant::find($item['product_variant_id']);
                    if ($variant) {
                        $variant->decrement('stock', $item['quantity']);
                        $product->syncStockWithVariants();
                    }
                } else {
                    $inv = Inventory::where('product_id', $item['product_id'])->first();
                    if ($inv) {
                        $inv->decrement('current_stock', $item['quantity']);
                    }
                }
            }

            if (!empty($data['discount_pct'])) {
                $subtotal = $subtotal * (1 - $data['discount_pct'] / 100);
            }

            // Include 12% VAT in total
            $totalWithVat = round($subtotal * 1.12, 2);

            // Concurrency-safe order number
            $lastNumber = Sale::lockForUpdate()->max('id');
            $orderNumber = 'ORD-' . str_pad(($lastNumber ?? 0) + 1, 5, '0', STR_PAD_LEFT);

            $sale = Sale::create([
                'order_number'   => $orderNumber,
                'customer_id'    => $data['customer_id'],
                'processed_by'   => $request->user()->id,
                'discount_pct'   => $data['discount_pct'] ?? null,
                'total_amount'   => $totalWithVat,
                'payment_method' => $data['payment_method'],
                'status'         => 'pending',
                'notes'          => $data['notes'] ?? null,
            ]);

            foreach ($itemsData as $item) {
                $sale->items()->create($item);
            }

            // Auto-create delivery with tracking number
            $trackingNumber = 'TRK-' . strtoupper(substr(md5($sale->id . now()->timestamp), 0, 8));

            // Get customer coordinates for delivery destination
            $customerProfile = \App\Models\CustomerProfile::where('user_id', $data['customer_id'])->first();

            Delivery::create([
                'sale_id'         => $sale->id,
                'tracking_number' => $trackingNumber,
                'status'          => 'pending',
                'address'         => $data['address'] ?? 'TBD',
                'latitude'        => $customerProfile->latitude ?? null,
                'longitude'       => $customerProfile->longitude ?? null,
            ]);

            return $sale;
        });

        return response()->json([
            'data'    => $sale->load(['customer', 'items.product', 'delivery']),
            'message' => 'Order created successfully',
            'status'  => 'success',
        ], 201);
    }

    public function show($id)
    {
        $sale = Sale::with(['customer', 'processedBy', 'items.product', 'delivery.rider'])->findOrFail($id);
        return response()->json(['data' => $sale, 'status' => 'success']);
    }

    public function updateStatus(Request $request, $id)
    {
        $sale = Sale::with(['delivery'])->findOrFail($id);

        $request->validate([
            'status' => 'required|in:pending,confirmed,out_for_delivery,delivered,returned,cancelled',
        ]);

        $newStatus = $request->status;
        $oldStatus = $sale->status;

        // Prevent changing status of already cancelled/returned orders
        if (in_array($oldStatus, ['cancelled', 'returned'])) {
            return response()->json([
                'message' => 'Cannot change status of a cancelled or returned order.',
                'status' => 'error',
            ], 422);
        }

        $sale->update(['status' => $newStatus]);

        // Sync delivery status with sale status
        if ($sale->delivery) {
            if ($newStatus === 'confirmed') {
                $sale->delivery->update(['status' => 'pending']);
            } elseif ($newStatus === 'out_for_delivery') {
                $sale->delivery->update(['status' => 'in_progress', 'pickup_at' => now()]);
            } elseif ($newStatus === 'delivered') {
                $sale->delivery->update(['status' => 'delivered', 'delivered_at' => now()]);
            }
        }

        // Notify customer on confirmation
        if ($newStatus === 'confirmed' && $sale->customer_id) {
            \App\Models\CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type' => 'confirmed',
                'message' => "Your order #{$sale->order_number} has been confirmed and is being prepared!",
                'is_read' => false,
            ]);
        }

        return response()->json([
            'data'    => $sale->fresh()->load(['customer', 'items.product', 'delivery']),
            'message' => 'Order status updated to ' . $newStatus,
            'status'  => 'success',
        ]);
    }

    public function processReturn(Request $request, $id)
    {
        $sale = Sale::findOrFail($id);
        $sale->update(['status' => 'returned']);

        // Restore stock
        foreach ($sale->items as $item) {
            if ($item->product_variant_id) {
                $variant = \App\Models\ProductVariant::find($item->product_variant_id);
                if ($variant) {
                    $variant->increment('stock', $item->quantity);
                    $item->product->syncStockWithVariants();
                }
            } else {
                $inv = Inventory::where('product_id', $item->product_id)->first();
                if ($inv) {
                    $inv->increment('current_stock', $item->quantity);
                }
            }
        }

        return response()->json([
            'data'    => $sale->fresh(),
            'message' => 'Order returned successfully',
            'status'  => 'success',
        ]);
    }

    public function cancelOrder(Request $request, $id)
    {
        $sale = Sale::with(['items', 'delivery'])->findOrFail($id);

        // Verify the customer owns this order
        if ($sale->customer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized', 'status' => 'error'], 403);
        }

        // Only pending orders can be cancelled
        if ($sale->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending orders can be cancelled.',
                'status' => 'error',
            ], 422);
        }

        DB::transaction(function () use ($sale) {
            // Restore stock
            foreach ($sale->items as $item) {
                if ($item->product_variant_id) {
                    $variant = \App\Models\ProductVariant::find($item->product_variant_id);
                    if ($variant) {
                        $variant->increment('stock', $item->quantity);
                        $item->product->syncStockWithVariants();
                    }
                } else {
                    $inv = Inventory::where('product_id', $item->product_id)->first();
                    if ($inv) {
                        $inv->increment('current_stock', $item->quantity);
                    }
                }
            }

            $sale->update(['status' => 'cancelled']);

            // Cancel associated delivery
            if ($sale->delivery) {
                $sale->delivery->update(['status' => 'failed']);
            }
        });

        return response()->json([
            'data'    => $sale->fresh()->load(['items.product', 'delivery']),
            'message' => 'Order cancelled successfully. Stock has been restored.',
            'status'  => 'success',
        ]);
    }

    public function summary(Request $request)
    {
        $today = now()->toDateString();

        $totalRevenue = Sale::whereIn('status', ['confirmed', 'out_for_delivery', 'delivered'])
            ->sum('total_amount');

        $ordersToday = Sale::whereDate('created_at', $today)->count();

        $lowStockCount = Inventory::whereRaw('current_stock <= reorder_threshold')->count();

        $activeRiders = \App\Models\User::where('role', 'rider')
            ->where('status', 'active')
            ->whereHas('riderProfile', function($q) {
                return $q->where('availability', 'on_delivery');
            })
            ->count();

        $recentOrders = Sale::with(['customer', 'items'])
            ->latest()->limit(10)->get();

        $lowStockProducts = Inventory::with(['product.category'])
            ->whereRaw('current_stock <= reorder_threshold')
            ->limit(5)->get();

        return response()->json([
            'data' => [
                'total_revenue'     => $totalRevenue,
                'orders_today'      => $ordersToday,
                'low_stock_count'   => $lowStockCount,
                'active_riders'     => $activeRiders,
                'recent_orders'     => $recentOrders,
                'low_stock_products' => $lowStockProducts,
            ],
            'status' => 'success',
        ]);
    }
}
