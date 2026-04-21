<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Models\Delivery;
use App\Models\Inventory;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    public function index(Request $request)
    {
        $query = Sale::with(['customer', 'items.product', 'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue', 'delivery'])
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
            'data'   => $query->paginate($request->get('per_page', 20)),
            'status' => 'success',
        ]);
    }

    public function store(Request $request)
    {
        \Log::info('=== SALE STORE METHOD CALLED ===', []);
        $data = $request->validate([
            'customer_id'    => 'required|exists:users,id',
            'items'          => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.quantity'   => 'required|numeric|min:1',
            'items.*.price'      => 'nullable|numeric|min:0',
            'payment_method'     => 'required|in:cod,cash,gcash,bank_transfer',
            'payment_phone_number'=> 'nullable|string|max:20',
            'discount_pct'   => 'nullable|numeric|between:0,100',
            'notes'          => 'nullable|string',
            'address'        => 'nullable|string',
        ]);

        // Debug: Log incoming order data
        \Log::info('New order received:', $data);

        // No expiration needed - reservations are only used during checkout

        // --- Stock validation before processing (accounts for reservations by OTHER customers) ---
        $customerId = $data['customer_id'];
        foreach ($data['items'] as $item) {
            $product = \App\Models\Product::findOrFail($item['product_id']);
            $variantId = $item['product_variant_id'] ?? null;

            if (!empty($variantId)) {
                $variant = \App\Models\ProductVariant::find($variantId);
                $totalStock = $variant ? $variant->stock : 0;
            } else {
                $inv = Inventory::where('product_id', $item['product_id'])->whereNull('product_variant_id')->first();
                $totalStock = $inv ? $inv->current_stock : 0;
            }

            $available = max(0, $totalStock);

            if ($item['quantity'] > $available) {
                return response()->json([
                    'message' => "Insufficient stock for {$product->name}. Available: {$available}",
                    'status' => 'error',
                ], 422);
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
                ];

                // Deduct stock
                if (!empty($item['product_variant_id'])) {
                    $variant = \App\Models\ProductVariant::find($item['product_variant_id']);
                    if ($variant) {
                        $oldStock = $variant->stock;
                        $variant->decrement('stock', $item['quantity']);
                        
                        // Also deduct from inventory current_stock for variants to maintain sync
                        $variantInventory = \App\Models\Inventory::where('product_id', $item['product_id'])
                            ->where('product_variant_id', $item['product_variant_id'])
                            ->first();
                        
                        if ($variantInventory) {
                            $variantInventory->decrement('current_stock', $item['quantity']);
                        }
                        
                        \Log::info('Stock deducted for variant', ['variant_id' => $item['product_variant_id'], 'old_stock' => $oldStock, 'quantity' => $item['quantity'], 'new_stock' => $oldStock - $item['quantity']]);

                        // Stock alert checks for variant
                        $newStock = $oldStock - $item['quantity'];
                        $threshold = $variantInventory->reorder_threshold ?? 5;
                        $productName = $product->name . ' (variant)';
                        static::checkStockAlerts($productName, $newStock, $threshold);
                    }
                } else {
                    $inv = Inventory::where('product_id', $item['product_id'])->first();
                    if ($inv) {
                        $oldStock = $inv->current_stock;
                        $inv->decrement('current_stock', $item['quantity']);
                        \Log::info('Stock deducted for product', ['product_id' => $item['product_id'], 'old_stock' => $oldStock, 'quantity' => $item['quantity'], 'new_stock' => $oldStock - $item['quantity']]);

                        // Stock alert checks for base product
                        $newStock = $oldStock - $item['quantity'];
                        static::checkStockAlerts($product->name, $newStock, $inv->reorder_threshold ?? 5);
                    }
                }
            }

            if (!empty($data['discount_pct'])) {
                $subtotal = $subtotal * (1 - $data['discount_pct'] / 100);
            }

            // Include 12% VAT in total
            $totalWithVat = round($subtotal * 1.12, 2);

            $status = $data['payment_method'] === 'gcash' ? 'pending_payment' : 'pending';

            $sale = Sale::create([
                'customer_id'        => $data['customer_id'],
                'processed_by'       => $request->user()->id,
                'discount_pct'       => $data['discount_pct'] ?? null,
                'total_amount'       => $totalWithVat,
                'payment_method'     => $data['payment_method'],
                'payment_phone_number'=> $data['payment_phone_number'] ?? null,
                'status'             => $status,
                'notes'              => $data['notes'] ?? null,
            ]);

            $sale->update([
                'order_number' => 'ORD-' . str_pad($sale->id, 5, '0', STR_PAD_LEFT),
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
                'status'          => 'waiting', // New status: Hidden from Riders until Admin confirms
                'address'         => $data['address'] ?? 'TBD',
                'latitude'        => $customerProfile->latitude ?? null,
                'longitude'       => $customerProfile->longitude ?? null,
            ]);



            return $sale;
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard', 'admin_deliveries'], 'sale.created'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_cart'], 'sale.created'));

        return response()->json([
            'data'          => $sale->load(['customer', 'items.product', 'delivery']),
            'gcash_payload' => Setting::get('gcash_payload', env('GCASH_BASE_PAYLOAD', '')),
            'message'       => 'Order created successfully',
            'status'        => 'success',
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $sale = Sale::with(['customer', 'processedBy', 'items.product', 'delivery.rider'])->findOrFail($id);

        $user = $request->user();
        if ($user instanceof \App\Models\User && $user->role === 'customer') {
            if ($sale->customer_id !== $user->id) {
                return response()->json([
                    'message' => 'Forbidden. You can only view your own orders.',
                    'status' => 'error'
                ], 403);
            }
        }

        return response()->json(['data' => $sale, 'status' => 'success']);
    }

    public function updateStatus(Request $request, $id)
    {
        $sale = Sale::with(['delivery'])->findOrFail($id);

        $request->validate([
            'status' => 'required|in:pending,confirmed,cancelled,pending_payment',
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

        if ($newStatus === 'confirmed') {
            Cache::tags(['products'])->flush();
        }

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

        // Notify customer in-app on every meaningful status change
        if ($sale->customer_id) {
            $notifications = [
                'confirmed'        => ['Order Confirmed',        "Your order #{$sale->order_number} has been confirmed and is being prepared."],
                'out_for_delivery' => ['Out for Delivery',       "Your order #{$sale->order_number} is now out for delivery. Expect it soon!"],
                'delivered'        => ['Order Delivered',        "Your order #{$sale->order_number} has been delivered. Thank you for your purchase!"],
                'cancelled'        => ['Order Cancelled',        "Your order #{$sale->order_number} has been cancelled."],
            ];
            if (isset($notifications[$newStatus])) {
                [$title, $message] = $notifications[$newStatus];
                \App\Models\CustomerNotification::create([
                    'customer_id' => $sale->customer_id,
                    'delivery_id' => $sale->delivery->id ?? null,
                    'type'        => $newStatus,
                    'title'       => $title,
                    'message'     => $message,
                    'is_read'     => false,
                ]);
            }
        }

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard', 'admin_deliveries'], 'sale.status_updated'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'sale.status_updated'));

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
                    // NOTE: Removed syncStockWithVariants() to keep base product and variant stocks independent
                }
            } else {
                $inv = Inventory::where('product_id', $item->product_id)->first();
                if ($inv) {
                    $inv->increment('current_stock', $item->quantity);
                }
            }
        }

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_inventory', 'admin_dashboard'], 'sale.returned'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders'], 'sale.returned'));

        return response()->json([
            'data'    => $sale->fresh(),
            'message' => 'Order returned successfully',
            'status'  => 'success',
        ]);
    }

    public function cancelOrder(Request $request, $id)
    {
        $sale = Sale::with(['items', 'delivery'])->findOrFail($id);
        $user = $request->user();
        $isAdmin = in_array($user->role, ['admin', 'manager']);
        $isOwner = $sale->customer_id === $user->id;

        // Authorization: must be owner or admin
        if (!$isOwner && !$isAdmin) {
            return response()->json(['message' => 'Unauthorized', 'status' => 'error'], 403);
        }

        $request->validate([
            'reason' => 'required|string|in:changed_mind,wrong_item,duplicate_order,price_issue,found_better,too_long,other',
            'notes'  => 'nullable|string|max:500',
        ]);

        if (in_array($sale->status, ['cancelled', 'returned', 'delivered'])) {
            return response()->json([
                'message' => 'This order can no longer be cancelled.',
                'status' => 'error',
            ], 422);
        }

        if (!$isAdmin && $sale->status === 'confirmed') {
            if ($sale->cancellation_status === 'pending') {
                return response()->json([
                    'message' => 'Cancellation request is already pending approval.',
                    'status' => 'error',
                ], 422);
            }

            $sale->update([
                'cancellation_status' => 'pending',
                'cancellation_reason' => $request->reason,
                'cancellation_notes' => $request->notes,
                'cancelled_by' => $user->id,
                'cancelled_at' => now(),
            ]);

            $customerId = $sale->customer_id;
            broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'sale.cancellation_requested'));
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'sale.cancellation_requested'));

            return response()->json([
                'data' => $sale->fresh()->load(['items.product', 'delivery']),
                'message' => 'Cancellation request submitted and pending admin approval.',
                'status' => 'pending_request',
            ]);
        }

        if (!in_array($sale->status, ['pending', 'confirmed'])) {
            return response()->json([
                'message' => 'Only pending or confirmed orders can be cancelled.',
                'status' => 'error',
            ], 422);
        }

        if (!$isAdmin && $sale->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending orders can be cancelled directly. Confirmed orders require admin approval.',
                'status' => 'error',
            ], 422);
        }

        DB::transaction(function () use ($sale, $request, $user) {
            // Restore stock
            $this->restoreStock($sale);

            $sale->update([
                'status'              => 'cancelled',
                'cancellation_reason' => $request->reason,
                'cancellation_notes'  => $request->notes,
                'cancelled_by'        => $user->id,
                'cancelled_at'        => now(),
            ]);

            // Cancel associated delivery
            if ($sale->delivery) {
                $sale->delivery->update(['status' => 'failed']);
            }

            // Notify customer
            \App\Models\CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type'        => 'cancelled',
                'title'       => 'Order Cancelled',
                'message'     => "Your order #{$sale->order_number} has been cancelled. Reason: " . str_replace('_', ' ', ucfirst($request->reason)),
                'is_read'     => false,
            ]);
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_inventory', 'admin_dashboard'], 'sale.cancelled'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications', 'customer_shop'], 'sale.cancelled'));

        return response()->json([
            'data'    => $sale->fresh()->load(['items.product', 'delivery']),
            'message' => 'Order cancelled successfully. Stock has been restored.',
            'status'  => 'success',
        ]);
    }

    public function getCancellationRequests(Request $request)
    {
        $query = Sale::with(['customer', 'items.product', 'delivery'])
            ->where('cancellation_status', 'pending')
            ->when($request->search, function ($q) use ($request) {
                $search = $request->search;

                return $q->where(function ($sq) use ($search) {
                    $sq->where('order_number', 'like', "%{$search}%")
                        ->orWhereHas('customer', function ($cq) use ($search) {
                            return $cq->where('name', 'like', "%{$search}%");
                        });
                });
            })
            ->latest('cancelled_at');

        return response()->json([
            'data' => $query->paginate($request->get('per_page', 20)),
            'status' => 'success',
        ]);
    }

    public function approveCancellation(Request $request, $id)
    {
        $sale = Sale::with(['items', 'delivery'])->findOrFail($id);

        if ($sale->cancellation_status !== 'pending') {
            return response()->json([
                'message' => 'Only pending cancellation requests can be approved.',
                'status' => 'error',
            ], 422);
        }

        $user = $request->user();

        DB::transaction(function () use ($sale, $user) {
            $this->restoreStock($sale);

            $sale->update([
                'status' => 'cancelled',
                'cancellation_status' => 'approved',
                'cancelled_by' => $user->id,
                'cancelled_at' => now(),
            ]);

            if ($sale->delivery) {
                $sale->delivery->update(['status' => 'failed']);
            }

            \App\Models\CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type' => 'cancellation_approved',
                'title' => 'Cancellation Approved',
                'message' => "Your cancellation request for order #{$sale->order_number} has been approved.",
                'is_read' => false,
            ]);
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_inventory', 'admin_dashboard'], 'sale.cancellation_approved'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications', 'customer_shop'], 'sale.cancellation_approved'));

        return response()->json([
            'data' => $sale->fresh()->load(['customer', 'items.product', 'delivery']),
            'message' => 'Cancellation request approved successfully.',
            'status' => 'success',
        ]);
    }

    public function rejectCancellation(Request $request, $id)
    {
        $validated = $request->validate([
            'admin_notes' => 'nullable|string|max:500',
        ]);

        $sale = Sale::with(['delivery'])->findOrFail($id);

        if ($sale->cancellation_status !== 'pending') {
            return response()->json([
                'message' => 'Only pending cancellation requests can be rejected.',
                'status' => 'error',
            ], 422);
        }

        $adminNotes = $validated['admin_notes'] ?? null;

        DB::transaction(function () use ($sale, $adminNotes) {
            $sale->update([
                'cancellation_status' => 'rejected',
            ]);

            $message = "Your cancellation request for order #{$sale->order_number} has been rejected.";
            if (!empty($adminNotes)) {
                $message .= " Admin note: {$adminNotes}";
            }

            \App\Models\CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $sale->delivery->id ?? null,
                'type' => 'cancellation_rejected',
                'title' => 'Cancellation Rejected',
                'message' => $message,
                'is_read' => false,
            ]);
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'sale.cancellation_rejected'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'sale.cancellation_rejected'));

        return response()->json([
            'data' => $sale->fresh()->load(['customer', 'items.product', 'delivery']),
            'message' => 'Cancellation request rejected successfully.',
            'status' => 'success',
        ]);
    }

    public function uploadGCashProof(Request $request, $id)
    {
        $sale = Sale::findOrFail($id);
        
        // Authorization: must be owner
        if ($sale->customer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized', 'status' => 'error'], 403);
        }

        if ($sale->payment_method !== 'gcash') {
            return response()->json(['message' => 'Only GCash orders can upload proof here.', 'status' => 'error'], 422);
        }

        $request->validate([
            'payment_proof' => 'required|image|max:5120', // max 5MB
            'payment_reference' => 'nullable|string|max:50',
        ]);

        $path = $request->file('payment_proof')->store('payment_proofs', 'public');

        $sale->update([
            'payment_proof_path' => $path,
            'payment_reference' => $request->payment_reference,
            'status' => 'verifying_payment'
        ]);

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'sale.payment_proof_uploaded'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders'], 'sale.payment_proof_uploaded'));

        return response()->json([
            'data' => $sale->fresh(),
            'message' => 'Payment proof uploaded successfully',
            'status' => 'success'
        ]);
    }

    public function cancellationPolicy(Request $request, $id)
    {
        $sale = Sale::findOrFail($id);

        $user = $request->user();
        if ($user instanceof \App\Models\User && $user->role === 'customer') {
            if ($sale->customer_id !== $user->id) {
                return response()->json([
                    'message' => 'Forbidden. You can only view your own orders.',
                    'status' => 'error'
                ], 403);
            }
        }

        $alreadyRequested = $sale->cancellation_status === 'pending';
        $cancellable = in_array($sale->status, ['pending', 'confirmed']) && !$alreadyRequested;
        $customerCanCancel = $sale->status === 'pending';
        $needsAdminApproval = $sale->status === 'confirmed';

        return response()->json([
            'data' => [
                'cancellable'          => $cancellable,
            'already_requested'    => $alreadyRequested,
                'customer_can_cancel'  => $customerCanCancel,
                'needs_admin_approval' => $needsAdminApproval,
                'current_status'       => $sale->status,
                'reasons' => [
                    ['value' => 'changed_mind',  'label' => 'Changed my mind'],
                    ['value' => 'wrong_item',    'label' => 'Ordered wrong item'],
                    ['value' => 'duplicate_order','label' => 'Duplicate order'],
                    ['value' => 'price_issue',   'label' => 'Price issue'],
                    ['value' => 'found_better',  'label' => 'Found better alternative'],
                    ['value' => 'too_long',      'label' => 'Taking too long'],
                    ['value' => 'other',         'label' => 'Other'],
                ],
            ],
            'status' => 'success',
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

    protected function restoreStock(Sale $sale): void
    {
        foreach ($sale->items as $item) {
            if ($item->product_variant_id) {
                $variant = \App\Models\ProductVariant::find($item->product_variant_id);
                if ($variant) {
                    $variant->increment('stock', $item->quantity);
                }

                $variantInventory = \App\Models\Inventory::where('product_id', $item->product_id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->first();

                if ($variantInventory) {
                    $variantInventory->increment('current_stock', $item->quantity);
                }
            } else {
                $inv = Inventory::where('product_id', $item->product_id)
                    ->whereNull('product_variant_id')
                    ->first();

                if ($inv) {
                    $inv->increment('current_stock', $item->quantity);
                }
            }
        }
    }

    /**
     * Check stock levels after a sale and notify admins if thresholds are hit.
     * Respects the low_stock_alerts and out_of_stock_alerts settings.
     */
    protected static function checkStockAlerts(string $productName, int $newStock, int $reorderThreshold): void
    {
        try {
            if ($newStock <= 0 && Setting::get('out_of_stock_alerts', '0') === '1') {
                $admins = \App\Models\User::whereIn('id', \Illuminate\Support\Facades\Cache::remember('admin_user_ids', 300, fn () => \App\Models\User::where('role', 'admin')->pluck('id')->all()))->get();
                foreach ($admins as $admin) {
                    $admin->notify(new \App\Notifications\StockAlert('out_of_stock', $productName, max(0, $newStock), $reorderThreshold));
                }
            } elseif ($newStock > 0 && $newStock <= $reorderThreshold && Setting::get('low_stock_alerts', '0') === '1') {
                $admins = \App\Models\User::whereIn('id', \Illuminate\Support\Facades\Cache::remember('admin_user_ids', 300, fn () => \App\Models\User::where('role', 'admin')->pluck('id')->all()))->get();
                foreach ($admins as $admin) {
                    $admin->notify(new \App\Notifications\StockAlert('low_stock', $productName, $newStock, $reorderThreshold));
                }
            }
        } catch (\Exception $e) {
            \Log::warning('Stock alert notification failed: ' . $e->getMessage());
        }
    }
}
