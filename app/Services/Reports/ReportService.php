<?php

namespace App\Services\Reports;

use App\Models\Inventory;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Delivery;
use Carbon\Carbon;

class ReportService
{
    private $allowedStatuses = ['delivered', 'paid', 'confirmed', 'out_for_delivery', 'pending', 'in_progress'];

    /**
     * Get sales report with period filtering.
     */
    public function getSalesReport($request)
    {
        $period = $request->get('period', 'year');
        $yearParam = $request->get('year');
        $monthParam = $request->get('month');
        $from = now()->startOfYear();
        $to = now()->endOfYear();
        $isDashboardCalendarFilter = $request->filled('year') || $request->filled('month');

        if ($isDashboardCalendarFilter) {
            $year = (int) ($yearParam ?: now()->year);
            $month = empty($monthParam) ? null : (int) $monthParam;
            $isYearlyView = ($period === 'year' || empty($month));

            if ($isYearlyView) {
                $from = now()->setYear($year)->startOfYear();
                $to = now()->setYear($year)->endOfYear();

                $rows = Sale::where('created_at', '>=', $from->copy()->startOfDay())
                    ->where('created_at', '<', $to->copy()->addDay()->startOfDay())
                    ->whereIn('status', $this->allowedStatuses)
                    ->selectRaw('DATE(created_at) as date, SUM(total_amount) as total_sales, COUNT(*) as order_count, AVG(total_amount) as average_order_value')
                    ->groupBy('date')
                    ->orderBy('date')
                    ->get()
                    ->map(fn($row) => [
                        'label'               => $row->date,
                        'value'               => round($row->total_sales, 2),
                        'date'                => $row->date,
                        'orders'              => (int) $row->order_count,
                        'total_sales'         => $row->total_sales,
                        'order_count'         => (int) $row->order_count,
                        'average_order_value' => round($row->average_order_value, 2),
                    ])
                    ->values()
                    ->toArray();

                $totalRevenue = array_sum(array_column($rows, 'total_sales'));
                $totalOrders = array_sum(array_column($rows, 'order_count'));
                $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

                return [
                    'data' => [
                        'chart_data' => $rows,
                    ],
                    'summary' => [
                        'total_revenue' => round($totalRevenue, 2),
                        'total_orders' => $totalOrders,
                        'avg_order_value' => round($avgOrderValue, 2),
                    ],
                    'status' => 'success',
                ];
            } else {
                $from = now()->setYear($year)->setMonth($month)->startOfMonth();
                $to = now()->setYear($year)->setMonth($month)->endOfMonth();

                $rows = Sale::where('created_at', '>=', $from->copy()->startOfDay())
                    ->where('created_at', '<', $to->copy()->addDay()->startOfDay())
                    ->whereIn('status', $this->allowedStatuses)
                    ->selectRaw('DATE(created_at) as date, SUM(total_amount) as total_sales, COUNT(*) as order_count, AVG(total_amount) as average_order_value')
                    ->groupBy('date')
                    ->orderBy('date')
                    ->get()
                    ->map(fn($row) => [
                        'label'               => $row->date,
                        'value'               => round($row->total_sales, 2),
                        'date'                => $row->date,
                        'orders'              => (int) $row->order_count,
                        'total_sales'         => $row->total_sales,
                        'order_count'         => (int) $row->order_count,
                        'average_order_value' => round($row->average_order_value, 2),
                    ])
                    ->values()
                    ->toArray();

                $totalRevenue = array_sum(array_column($rows, 'total_sales'));
                $totalOrders = array_sum(array_column($rows, 'order_count'));
                $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

                return [
                    'data' => [
                        'chart_data' => $rows,
                    ],
                    'summary' => [
                        'total_revenue' => round($totalRevenue, 2),
                        'total_orders' => $totalOrders,
                        'avg_order_value' => round($avgOrderValue, 2),
                    ],
                    'status' => 'success',
                ];
            }
        }

        return [
            'data' => [
                'chart_data' => [],
            ],
            'summary' => [
                'total_revenue' => 0,
                'total_orders' => 0,
                'avg_order_value' => 0,
            ],
            'status' => 'success',
        ];
    }

    /**
     * Get top products report.
     */
    public function getTopProducts($request)
    {
        $limit = $request->get('limit', 10);

        $topProducts = SaleItem::with('product')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereIn('sales.status', $this->allowedStatuses)
            ->selectRaw('product_id, SUM(quantity) as total_sold, AVG(unit_price) as avg_price, COUNT(DISTINCT sale_id) as order_count')
            ->groupBy('product_id')
            ->orderByDesc('total_sold')
            ->limit($limit)
            ->get()->toArray();

        return [
            'data' => $topProducts,
            'status' => 'success',
        ];
    }

    /**
     * Get category sales report.
     */
    public function getCategorySales($request)
    {
        $period = $request->get('period', 'year');
        $categoryId = $request->get('category_id');

        $from = $this->getPeriodDates($period)['from'];
        $to = $this->getPeriodDates($period)['to'];

        $query = Sale::join('sale_items', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->where('sales.created_at', '>=', $from)
            ->where('sales.created_at', '<=', $to)
            ->whereIn('sales.status', $this->allowedStatuses)
            ->selectRaw('products.category_id, COUNT(DISTINCT sales.id) as orders, SUM(sale_items.quantity) as items_sold, SUM(sale_items.quantity * sale_items.unit_price) as revenue')
            ->groupBy('products.category_id');

        if ($categoryId) {
            $query->where('products.category_id', $categoryId);
        }

        $data = $query->orderByDesc('revenue')->get()->toArray();

        return [
            'data' => $data,
            'period_label' => $this->getPeriodLabel($period),
            'status' => 'success',
        ];
    }

    /**
     * Get yearly category revenue report.
     */
    public function getYearlyCategoryRevenue($request)
    {
        $year = $request->get('year', now()->year);
        $limit = $request->get('limit', 10);

        $from = Carbon::create($year, 1, 1)->startOfYear();
        $to = Carbon::create($year, 12, 31)->endOfYear();

        $data = Sale::join('sale_items', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->join('categories', 'products.category_id', '=', 'categories.id')
            ->where('sales.created_at', '>=', $from)
            ->where('sales.created_at', '<=', $to)
            ->whereIn('sales.status', $this->allowedStatuses)
            ->selectRaw('categories.id as category_id, categories.name as name, SUM(sale_items.quantity * sale_items.unit_price) as revenue')
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get()
            ->map(fn($row) => [
                'name' => $row->name,
                'revenue' => round($row->revenue, 2),
                'category_id' => $row->category_id,
            ])
            ->values()
            ->toArray();

        return [
            'data' => [
                'categories' => $data,
            ],
            'status' => 'success',
        ];
    }

    /**
     * Get return rate by category.
     */
    public function getReturnRateByCategory($request)
    {
        $period = $request->get('period', 'year');
        $from = $this->getPeriodDates($period)['from'];
        $to = $this->getPeriodDates($period)['to'];

        $returnedCount = Sale::join('sale_items', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->leftJoin('categories', 'products.category_id', '=', 'categories.id')
            ->where('sales.created_at', '>=', $from)
            ->where('sales.created_at', '<=', $to)
            ->where('sales.status', 'returned')
            ->selectRaw('products.category_id, categories.name as category_name, COUNT(*) as count')
            ->groupBy('products.category_id', 'categories.name')
            ->get()
            ->keyBy('category_id');

        $totalCount = Sale::join('sale_items', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->leftJoin('categories', 'products.category_id', '=', 'categories.id')
            ->where('sales.created_at', '>=', $from)
            ->where('sales.created_at', '<=', $to)
            ->whereIn('sales.status', $this->allowedStatuses)
            ->selectRaw('products.category_id, categories.name as category_name, COUNT(*) as count')
            ->groupBy('products.category_id', 'categories.name')
            ->get()
            ->keyBy('category_id');

        $data = $totalCount->map(function ($item) use ($returnedCount) {
            $categoryId = $item->category_id;
            $returnedItem = $returnedCount->get($categoryId);
            $returned = $returnedItem ? $returnedItem->count : 0;
            $total = $item->count ?? 1;
            $rate = ($returned / $total) * 100;

            return [
                'category_id' => $categoryId,
                'name' => $item->category_name ?? 'Uncategorized',
                'total_orders' => $total,
                'returned_orders' => $returned,
                'return_rate' => round($rate, 2),
            ];
        })->values()->toArray();

        return [
            'data' => $data,
            'period_label' => $this->getPeriodLabel($period),
            'status' => 'success',
        ];
    }

    /**
     * Get inventory status report.
     */
    public function getInventoryReport($request)
    {
        $inventoryQueryService = new \App\Services\Inventory\InventoryQueryService();
        $inventoryData = $inventoryQueryService->getList($request);

        $inventoryArray = $inventoryData['data'] ?? [];
        $totalItems = count($inventoryArray);
        $lowStockCount = $inventoryData['low_stock_count'] ?? 0;
        $totalValue = collect($inventoryArray)->sum(function ($item) {
            return ($item['current_stock'] ?? 0) * ($item['sell_price'] ?? 0);
        });

        return [
            'data' => $inventoryArray,
            'total_items' => $totalItems,
            'low_stock_count' => $lowStockCount,
            'total_value' => round($totalValue, 2),
            'status' => 'success',
        ];
    }

    /**
     * Get rating analytics.
     */
    public function getRatingAnalytics($request)
    {
        $period = $request->get('period', 'month');
        $from = $this->getPeriodDates($period)['from'];
        $to = $this->getPeriodDates($period)['to'];

        $ratings = Delivery::with(['rider:id,name', 'sale.customer:id,name'])
            ->whereNotNull('rating')
            ->where('rated_at', '>=', $from)
            ->where('rated_at', '<=', $to)
            ->orderByDesc('rated_at')
            ->get()->toArray();

        $totalRatings = count($ratings);
        $averageRating = $totalRatings > 0 ? round(collect($ratings)->avg('rating'), 2) : 0;

        $distribution = [
            1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0,
        ];
        foreach ($ratings as $entry) {
            $star = (int) round($entry['rating']);
            if (isset($distribution[$star])) {
                $distribution[$star]++;
            }
        }

        $percentages = [];
        foreach ($distribution as $star => $count) {
            $percentages[$star] = $totalRatings > 0
                ? round(($count / $totalRatings) * 100, 2)
                : 0;
        }

        $byRider = collect($ratings)
            ->groupBy('rider_id')
            ->map(function ($items) {
                $total = count($items);
                $avg = round(collect($items)->avg('rating'), 2);
                $positive = collect($items)->where('rating', '>=', 4)->count();
                $first = $items[0];

                return [
                    'rider_id' => $first['rider_id'],
                    'rider_name' => $first['rider']['name'] ?? 'Unknown Rider',
                    'average_rating' => $avg,
                    'total_ratings' => $total,
                    'positive_rate' => $total > 0 ? round(($positive / $total) * 100, 2) : 0,
                ];
            })
            ->values()
            ->toArray();

        $topPerformers = collect($byRider)
            ->where('average_rating', '>=', 4.0)
            ->where('total_ratings', '>=', 5)
            ->sortByDesc('average_rating')
            ->values()
            ->take(10)
            ->values()
            ->toArray();

        $needsImprovement = collect($byRider)
            ->where('average_rating', '<', 3.0)
            ->sortBy('average_rating')
            ->values()
            ->take(10)
            ->values()
            ->toArray();

        $ratingTrends = collect($ratings)
            ->groupBy(function ($item) {
                return $item['rated_at'] ? date('Y-m-d', strtotime($item['rated_at'])) : null;
            })
            ->map(function ($items, $date) {
                return [
                    'date' => $date,
                    'average_rating' => round(collect($items)->avg('rating'), 2),
                    'count' => count($items),
                ];
            })
            ->sortBy('date')
            ->values()
            ->toArray();

        return [
            'date_range' => [
                'from' => $from->format('Y-m-d'),
                'to' => $to->format('Y-m-d'),
                'period' => $period,
            ],
            'overall_stats' => [
                'average_rating' => $averageRating,
                'total_ratings' => $totalRatings,
                'rating_distribution' => $distribution,
                'rating_percentages' => $percentages,
            ],
            'top_performers' => $topPerformers,
            'needs_improvement' => $needsImprovement,
            'rating_trends' => $ratingTrends,
            'status' => 'success',
        ];
    }

    public function getRatingAnalyticsRankings($request)
    {
        $period = $request->get('period', 'month');
        $from = $this->getPeriodDates($period)['from'];
        $to = $this->getPeriodDates($period)['to'];
        $limit = (int) $request->get('limit', 100);

        $rows = Delivery::with('rider:id,name')
            ->whereNotNull('rating')
            ->whereBetween('rated_at', [$from, $to])
            ->get()
            ->groupBy('rider_id')
            ->map(function ($items) {
                $total = $items->count();
                $avg = round($items->avg('rating'), 2);
                $positive = $items->where('rating', '>=', 4)->count();
                $first = $items->first();
                return [
                    'rider_id' => $first->rider_id,
                    'rider_name' => optional($first->rider)->name ?? 'Unknown Rider',
                    'average_rating' => $avg,
                    'total_ratings' => $total,
                    'positive_rate' => $total > 0 ? round(($positive / $total) * 100, 2) : 0,
                ];
            })
            ->sortByDesc('average_rating')
            ->take($limit)
            ->values()
            ->toArray();

        return [
            'data' => $rows,
            'total' => count($rows),
            'status' => 'success',
        ];
    }

    public function getRatingAnalyticsFeedback($request)
    {
        $period = $request->get('period', 'month');
        $from = $this->getPeriodDates($period)['from'];
        $to = $this->getPeriodDates($period)['to'];
        $limit = (int) $request->get('limit', 100);

        $rows = Delivery::with(['rider:id,name', 'sale.customer:id,name'])
            ->whereNotNull('rating')
            ->whereBetween('rated_at', [$from, $to])
            ->orderByDesc('rated_at')
            ->limit($limit)
            ->get()
            ->map(function ($delivery) {
                return [
                    'delivery_id' => $delivery->id,
                    'tracking_number' => $delivery->tracking_number,
                    'rating' => $delivery->rating,
                    'rating_comment' => $delivery->rating_comment,
                    'rated_at' => optional($delivery->rated_at)->toDateTimeString(),
                    'customer_name' => optional(optional($delivery->sale)->customer)->name ?? 'Unknown Customer',
                    'rider_name' => optional($delivery->rider)->name ?? 'Unknown Rider',
                ];
            })
            ->values();

        return [
            'data' => $rows,
            'total' => $rows->count(),
            'status' => 'success',
        ];
    }

    /**
     * Get customer behavior analytics.
     */
    public function getCustomerBehavior($request)
    {
        $from = now()->subMonths(3);

        $topCustomers = Sale::where('created_at', '>=', $from)
            ->with('customer')
            ->selectRaw('customer_id, COUNT(*) as order_count, SUM(total_amount) as lifetime_value, AVG(total_amount) as avg_order_value')
            ->groupBy('customer_id')
            ->orderByDesc('lifetime_value')
            ->limit(15)
            ->get();

        return [
            'data' => $topCustomers,
            'period_label' => 'Last 3 Months',
            'status' => 'success',
        ];
    }

    /**
     * Get profit margins analysis.
     */
    public function getProfitMargins($request)
    {
        $period = $request->get('period', 'year');
        $from = $this->getPeriodDates($period)['from'];
        $to = $this->getPeriodDates($period)['to'];

        $salesData = SaleItem::join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->where('sales.created_at', '>=', $from)
            ->where('sales.created_at', '<=', $to)
            ->whereIn('sales.status', $this->allowedStatuses)
            ->selectRaw('
                SUM(sale_items.quantity) as units_sold,
                SUM(sale_items.quantity * sale_items.unit_price) as total_revenue,
                SUM(sale_items.quantity * products.purchase_price) as total_cost
            ')
            ->first();

        $profit = ($salesData->total_revenue ?? 0) - ($salesData->total_cost ?? 0);
        $margin = ($salesData->total_revenue ?? 0) > 0 ? ($profit / $salesData->total_revenue) * 100 : 0;

        return [
            'total_revenue' => $salesData->total_revenue ?? 0,
            'total_cost' => $salesData->total_cost ?? 0,
            'total_profit' => $profit,
            'profit_margin_percent' => round($margin, 2),
            'units_sold' => $salesData->units_sold ?? 0,
            'period_label' => $this->getPeriodLabel($period),
            'status' => 'success',
        ];
    }

    /**
     * Get recent activity.
     */
    public function getRecentActivity()
    {
        $recentSales = Sale::with('customer')
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(function ($sale) {
                return [
                    'id' => 'sale-' . $sale->id,
                    'type' => 'sale',
                    'title' => 'New Order #' . $sale->order_number,
                    'message' => $sale->customer->name . ' placed an order',
                    'timestamp' => $sale->created_at,
                    'status' => 'Processing',
                    'icon' => 'ShoppingBag',
                ];
            })->toArray();

        $recentDeliveries = \App\Models\Delivery::with('sale', 'rider')
            ->where('status', 'delivered')
            ->orderByDesc('updated_at')
            ->limit(10)
            ->get()
            ->map(function ($delivery) {
                return [
                    'id' => 'delivery-' . $delivery->id,
                    'type' => 'delivery',
                    'title' => 'Order Delivered',
                    'message' => 'Order #' . optional($delivery->sale)->order_number . ' delivered by ' . optional($delivery->rider)->name,
                    'timestamp' => $delivery->updated_at,
                    'status' => 'Delivered',
                    'icon' => 'CheckCircle',
                ];
            })->toArray();

        $activities = array_merge($recentSales, $recentDeliveries);
        usort($activities, function ($a, $b) {
            return strtotime($b['timestamp']) - strtotime($a['timestamp']);
        });

        return [
            'data' => array_slice($activities, 0, 20),
            'status' => 'success',
        ];
    }

    /**
     * Get inventory forecast.
     */
    public function getInventoryForecast($request)
    {
        $days = $request->get('days', 30);
        $today = now();
        $forecastDate = $today->copy()->addDays($days);

        $inventory = Inventory::with('product')
            ->get()
            ->map(function ($inv) use ($today, $days) {
                $avgDailySold = $this->getAverageDailySalesRate($inv->product_id, 30);
                $projectedStockAtEnd = max(0, $inv->current_stock - ($avgDailySold * $days));
                $daysUntilOutOfStock = $avgDailySold > 0 ? floor($inv->current_stock / $avgDailySold) : PHP_INT_MAX;

                return [
                    'product_id' => $inv->product_id,
                    'product_name' => $inv->product->name,
                    'current_stock' => $inv->current_stock,
                    'avg_daily_sales' => round($avgDailySold, 2),
                    'projected_stock_at_end' => max(0, $projectedStockAtEnd),
                    'days_until_stockout' => $daysUntilOutOfStock === PHP_INT_MAX ? null : $daysUntilOutOfStock,
                    'status' => $projectedStockAtEnd <= 0 ? 'critical' : ($daysUntilOutOfStock < 7 ? 'warning' : 'ok'),
                ];
            });

        return [
            'data' => $inventory,
            'forecast_days' => $days,
            'status' => 'success',
        ];
    }

    /**
     * Helper: Get period dates.
     */
    private function getPeriodDates($period)
    {
        switch ($period) {
            case 'month':
                return ['from' => now()->startOfMonth(), 'to' => now()->endOfMonth()];
            case 'week':
                return ['from' => now()->startOfWeek(), 'to' => now()->endOfWeek()];
            case 'year':
            default:
                return ['from' => now()->startOfYear(), 'to' => now()->endOfYear()];
        }
    }

    /**
     * Helper: Get period label.
     */
    private function getPeriodLabel($period)
    {
        $labels = ['month' => 'This Month', 'week' => 'This Week', 'year' => 'This Year'];
        return $labels[$period] ?? 'N/A';
    }

    /**
     * Helper: Get average daily sales rate for a product.
     */
    private function getAverageDailySalesRate($productId, $days = 30)
    {
        $from = now()->subDays($days);

        $totalSold = SaleItem::where('product_id', $productId)
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.created_at', '>=', $from)
            ->whereIn('sales.status', $this->allowedStatuses)
            ->sum('quantity');

        return $days > 0 ? $totalSold / $days : 0;
    }
}
