<?php

namespace App\Services\Sales;

use App\Models\Sale;

class SaleQueryService
{
    /**
     * Get paginated list of sales with filtering and search.
     */
    public function getList($request)
    {
        $query = Sale::with(['customer', 'items.product', 'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue', 'delivery'])
            ->when($request->status, function ($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function ($q) use ($request) {
                return $q->where('order_number', 'like', "%{$request->search}%")
                    ->orWhereHas('customer', function ($cq) use ($request) {
                        return $cq->where('name', 'like', "%{$request->search}%");
                    });
            })
            ->when($request->from, function ($q) use ($request) {
                return $q->whereDate('created_at', '>=', $request->from);
            })
            ->when($request->to, function ($q) use ($request) {
                return $q->whereDate('created_at', '<=', $request->to);
            })
            ->latest();

        return $query->paginate($request->get('per_page', 20));
    }

    /**
     * Get a single sale with authorization check.
     */
    public function getDetail($id, $user)
    {
        $sale = Sale::with(['customer', 'processedBy', 'items.product', 'delivery.rider'])->findOrFail($id);

        if ($user instanceof \App\Models\User && $user->role === 'customer') {
            if ($sale->customer_id !== $user->id) {
                return [
                    'error' => 'Forbidden. You can only view your own orders.',
                    'status_code' => 403,
                ];
            }
        }

        return [
            'sale' => $sale,
            'status_code' => 200,
        ];
    }

    /**
     * Get sales summary for dashboard.
     */
    public function getSummary()
    {
        $today = now()->toDateString();

        $totalRevenue = Sale::whereIn('status', ['confirmed', 'out_for_delivery', 'delivered'])
            ->sum('total_amount');

        $ordersToday = Sale::whereDate('created_at', $today)->count();

        $lowStockCount = \App\Models\Inventory::where('is_low_stock', 1)->count();

        $activeRiders = \App\Models\User::where('role', 'rider')
            ->where('status', 'active')
            ->whereHas('riderProfile', function ($q) {
                return $q->where('availability', 'on_delivery');
            })
            ->count();

        $recentOrders = Sale::with(['customer', 'items'])
            ->latest()->limit(10)->get();

        $lowStockProducts = \App\Models\Inventory::with(['product.category'])
            ->where('is_low_stock', 1)
            ->limit(5)->get();

        return [
            'total_revenue' => $totalRevenue,
            'orders_today' => $ordersToday,
            'low_stock_count' => $lowStockCount,
            'active_riders' => $activeRiders,
            'recent_orders' => $recentOrders,
            'low_stock_products' => $lowStockProducts,
        ];
    }
}
