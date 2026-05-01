<?php

namespace App\Services\Reports;

use App\Models\Inventory;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportService
{
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
        $chartData = collect();
        $allowedStatuses = ['delivered', 'paid', 'confirmed', 'out_for_delivery', 'pending', 'in_progress'];
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        $isDashboardCalendarFilter = $request->filled('year') || $request->filled('month');

        if ($isDashboardCalendarFilter) {
            $year = (int) ($yearParam ?: now()->year);
            $month = empty($monthParam) ? null : (int) $monthParam;
            $isYearlyView = ($period === 'year' || empty($month));

            if ($isYearlyView) {
                $from = now()->setYear($year)->startOfYear();
                $to = now()->setYear($year)->endOfYear();

                $rows = Sale::where('created_at', '>=', $from->copy()->startOfDay())->where('created_at', '<', $to->copy()->addDay()->startOfDay())
                    ->whereIn('status', $allowedStatuses)
                    ->selectRaw('MONTH(created_at) as bucket, SUM(total_amount) as revenue, COUNT(*) as orders')
                    ->groupBy('bucket')
                    ->orderBy('bucket')
                    ->get();

                $chartData = collect(range(1, 12))->map(function ($i) use ($rows, $months) {
                    $found = $rows->firstWhere('bucket', $i);
                    return [
                        'label' => $months[$i - 1],
                        'orders' => $found ? (int) $found->orders : 0,
                        'revenue' => $found ? round((float) $found->revenue, 2) : 0,
                    ];
                });
            } else {
                $month = max(1, min(12, $month));
                $from = now()->setYear($year)->setMonth($month)->startOfMonth();
                $to = (clone $from)->endOfMonth();

                $rows = Sale::where('created_at', '>=', $from->copy()->startOfDay())->where('created_at', '<', $to->copy()->addDay()->startOfDay())
                    ->whereIn('status', $allowedStatuses)
                    ->selectRaw('DAY(created_at) as bucket, SUM(total_amount) as revenue, COUNT(*) as orders')
                    ->groupBy('bucket')
                    ->orderBy('bucket')
                    ->get();

                $chartData = collect(range(1, $from->daysInMonth))->map(function ($i) use ($rows) {
                    $found = $rows->firstWhere('bucket', $i);
                    return [
                        'label' => (string) $i,
                        'orders' => $found ? (int) $found->orders : 0,
                        'revenue' => $found ? round((float) $found->revenue, 2) : 0,
                    ];
                });
            }
        } else {
            if ($period === 'year') {
                $from = now()->startOfYear();
                $to = now()->endOfYear();

                $rows = Sale::where('created_at', '>=', $from->copy()->startOfDay())->where('created_at', '<', $to->copy()->addDay()->startOfDay())
                    ->whereIn('status', $allowedStatuses)
                    ->selectRaw('MONTH(created_at) as bucket, SUM(total_amount) as revenue, COUNT(*) as orders')
                    ->groupBy('bucket')
                    ->orderBy('bucket')
                    ->get();

                $chartData = collect(range(1, 12))->map(function ($i) use ($rows, $months) {
                    $found = $rows->firstWhere('bucket', $i);
                    return [
                        'label' => $months[$i - 1],
                        'orders' => $found ? (int) $found->orders : 0,
                        'revenue' => $found ? round((float) $found->revenue, 2) : 0,
                    ];
                });
            } else {
                if ($period === 'week') {
                    $from = now()->subDays(6)->startOfDay();
                    $to = now()->endOfDay();
                } elseif ($period === 'quarter') {
                    $from = now()->subDays(89)->startOfDay();
                    $to = now()->endOfDay();
                } else {
                    $from = now()->startOfMonth();
                    $to = now()->endOfMonth();
                }

                $rows = Sale::where('created_at', '>=', $from->copy()->startOfDay())->where('created_at', '<', $to->copy()->addDay()->startOfDay())
                    ->whereIn('status', $allowedStatuses)
                    ->selectRaw('DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders')
                    ->groupBy('date')
                    ->orderBy('date')
                    ->get();

                $chartData = $rows->map(function ($row) {
                    return [
                        'label' => \Carbon\Carbon::parse($row->date)->format('j'),
                        'date' => $row->date,
                        'orders' => (int) $row->orders,
                        'revenue' => round((float) $row->revenue, 2),
                    ];
                });
            }
        }

        $summaryData = Sale::where('created_at', '>=', $from->copy()->startOfDay())->where('created_at', '<', $to->copy()->addDay()->startOfDay())
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(CASE WHEN status = "delivered" THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN status = "returned" THEN 1 ELSE 0 END) as returned_orders,
                SUM(CASE WHEN status = "in_progress" THEN 1 ELSE 0 END) as in_progress_orders,
                SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed_orders,
                SUM(CASE WHEN payment_method = "cod" THEN total_amount ELSE 0 END) as cod_revenue,
                SUM(CASE WHEN payment_method = "cod" THEN 1 ELSE 0 END) as cod_orders,
                SUM(CASE WHEN payment_method = "gcash" THEN total_amount ELSE 0 END) as gcash_revenue,
                SUM(CASE WHEN payment_method = "gcash" THEN 1 ELSE 0 END) as gcash_orders
            ')->first();

        $totalRevenue = $summaryData->total_revenue ?? 0;
        $totalOrders = $summaryData->total_orders ?? 0;
        $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        return [
            'data' => [
                'chart_data' => $chartData->values(),
                'summary' => [
                    'total_revenue' => round($totalRevenue, 2),
                    'total_orders' => $totalOrders,
                    'average_order_value' => round($avgOrderValue, 2),
                    'delivered_orders' => $summaryData->delivered_orders ?? 0,
                    'pending_orders' => $summaryData->pending_orders ?? 0,
                    'in_progress_orders' => $summaryData->in_progress_orders ?? 0,
                    'failed_orders' => $summaryData->failed_orders ?? 0,
                    'returned_orders' => $summaryData->returned_orders ?? 0,
                    'cod_revenue' => $summaryData->cod_revenue ?? 0,
                    'cod_orders' => $summaryData->cod_orders ?? 0,
                    'gcash_revenue' => $summaryData->gcash_revenue ?? 0,
                    'gcash_orders' => $summaryData->gcash_orders ?? 0,
                ]
            ],
            'status' => 'success',
        ];
    }

    /**
     * Get top products report.
     */
    public function getTopProducts($request)
    {
        try {
            $period = $request->get('period', 'month');
            $from = now();
            $to = now();

            if ($period === 'week') {
                $from = now()->subDays(7);
            } elseif ($period === 'year') {
                $from = now()->subYear();
            } elseif ($period === 'quarter') {
                $from = now()->subDays(90);
            } else {
                $from = now()->subDays(30);
            }

            $topProducts = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->where('sales.created_at', '>=', $from->copy()->startOfDay())->where('sales.created_at', '<', $to->copy()->addDay()->startOfDay())
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'returned'])
                ->select(
                    'products.id',
                    'products.name',
                    'products.barcode',
                    DB::raw('SUM(sale_items.quantity) as total_sold'),
                    DB::raw('SUM(sale_items.quantity * sale_items.unit_price) as revenue')
                )
                ->groupBy('products.id', 'products.name', 'products.barcode')
                ->orderByDesc('total_sold')
                ->limit(10)
                ->get();

            return [
                'data' => $topProducts,
                'status' => 'success',
            ];
        } catch (\Exception $e) {
            \Log::error('Top Products Query Error', ['message' => $e->getMessage()]);
            return [
                'error' => 'Failed to fetch top products',
                'message' => 'Database query failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get category sales report.
     */
    public function getCategorySales($request)
    {
        try {
            $period = $request->get('period', 'month');
            $limit = min((int) $request->get('limit', 10), 50);

            switch ($period) {
                case 'week':
                    $currentFrom = now()->subDays(7)->toDateString();
                    $currentTo = now()->toDateString();
                    $previousFrom = now()->subDays(14)->toDateString();
                    $previousTo = now()->subDays(7)->toDateString();
                    $periodLabel = 'This Week';
                    $prevLabel = 'Last Week';
                    break;
                case 'year':
                    $currentFrom = now()->subYear()->toDateString();
                    $currentTo = now()->toDateString();
                    $previousFrom = now()->subYears(2)->toDateString();
                    $previousTo = now()->subYear()->toDateString();
                    $periodLabel = 'This Year';
                    $prevLabel = 'Last Year';
                    break;
                default:
                    $currentFrom = now()->subDays(30)->toDateString();
                    $currentTo = now()->toDateString();
                    $previousFrom = now()->subDays(60)->toDateString();
                    $previousTo = now()->subDays(30)->toDateString();
                    $periodLabel = 'This Month';
                    $prevLabel = 'Last Month';
                    break;
            }

            $topCategoryIds = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->where('sales.created_at', '>=', Carbon::parse($currentFrom)->startOfDay())->where('sales.created_at', '<', Carbon::parse($currentTo)->addDay()->startOfDay())
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'confirmed', 'out_for_delivery', 'returned'])
                ->whereNotNull('products.category_id')
                ->groupBy('products.category_id')
                ->orderByRaw('SUM(sale_items.quantity * sale_items.unit_price) DESC')
                ->limit($limit)
                ->pluck('products.category_id');

            if ($topCategoryIds->isEmpty()) {
                return [
                    'data' => [
                        'categories' => [],
                        'period_label' => $periodLabel,
                        'prev_label' => $prevLabel,
                        'total_categories' => 0,
                    ],
                    'status' => 'success',
                ];
            }

            $currentData = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('categories', 'products.category_id', '=', 'categories.id')
                ->where('sales.created_at', '>=', Carbon::parse($currentFrom)->startOfDay())->where('sales.created_at', '<', Carbon::parse($currentTo)->addDay()->startOfDay())
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'confirmed', 'out_for_delivery', 'returned'])
                ->whereIn('products.category_id', $topCategoryIds)
                ->groupBy('categories.id', 'categories.name')
                ->select(
                    'categories.id',
                    'categories.name',
                    DB::raw('SUM(sale_items.quantity * sale_items.unit_price) as revenue'),
                    DB::raw('SUM(sale_items.quantity) as units_sold')
                )
                ->get()
                ->keyBy('id');

            $previousData = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->whereIn('products.category_id', $topCategoryIds)
                ->where('sales.created_at', '>=', Carbon::parse($previousFrom)->startOfDay())->where('sales.created_at', '<', Carbon::parse($previousTo)->addDay()->startOfDay())
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'confirmed', 'out_for_delivery', 'returned'])
                ->groupBy('products.category_id')
                ->select(
                    'products.category_id as id',
                    DB::raw('SUM(sale_items.quantity * sale_items.unit_price) as revenue'),
                    DB::raw('SUM(sale_items.quantity) as units_sold')
                )
                ->get()
                ->keyBy('id');

            $totalCategories = DB::table('products')
                ->whereNotNull('category_id')
                ->distinct('category_id')
                ->count('category_id');

            $categories = [];
            foreach ($currentData as $id => $cat) {
                $prev = $previousData->get($id);
                $prevRevenue = $prev ? (float) $prev->revenue : 0;
                $curRevenue = (float) $cat->revenue;
                $growth = $prevRevenue > 0
                    ? round((($curRevenue - $prevRevenue) / $prevRevenue) * 100, 1)
                    : ($curRevenue > 0 ? 100 : 0);

                $categories[] = [
                    'id' => $id,
                    'name' => $cat->name,
                    'current_revenue' => round($curRevenue, 2),
                    'previous_revenue' => round($prevRevenue, 2),
                    'current_units' => (int) $cat->units_sold,
                    'previous_units' => $prev ? (int) $prev->units_sold : 0,
                    'growth' => $growth,
                ];
            }

            usort($categories, function ($a, $b) {
                return $b['current_revenue'] - $a['current_revenue'];
            });

            return [
                'data' => [
                    'categories' => $categories,
                    'period_label' => $periodLabel,
                    'prev_label' => $prevLabel,
                    'total_categories' => $totalCategories,
                ],
                'status' => 'success',
            ];
        } catch (\Exception $e) {
            \Log::error('Category Sales Error', ['message' => $e->getMessage()]);
            return [
                'error' => 'Failed to fetch category sales',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get yearly category revenue report.
     */
    public function getYearlyCategoryRevenue($request)
    {
        try {
            $year = (int) $request->get('year', now()->year);
            $limit = min((int) $request->get('limit', 10), 50);

            $from = "{$year}-01-01";
            $to = "{$year}-12-31";

            $categories = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('categories', 'products.category_id', '=', 'categories.id')
                ->where('sales.created_at', '>=', Carbon::parse($from)->startOfDay())->where('sales.created_at', '<', Carbon::parse($to)->addDay()->startOfDay())
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'confirmed', 'out_for_delivery', 'returned'])
                ->whereNotNull('products.category_id')
                ->groupBy('categories.id', 'categories.name')
                ->orderByRaw('SUM(sale_items.quantity * sale_items.unit_price) DESC')
                ->limit($limit)
                ->select(
                    'categories.id',
                    'categories.name',
                    DB::raw('ROUND(SUM(sale_items.quantity * sale_items.unit_price), 2) as revenue'),
                    DB::raw('SUM(sale_items.quantity) as units_sold')
                )
                ->get();

            return [
                'data' => ['categories' => $categories, 'year' => $year],
                'status' => 'success',
            ];
        } catch (\Exception $e) {
            return [
                'error' => 'Failed to fetch yearly category revenue',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get return rate by category.
     */
    public function getReturnRateByCategory($request)
    {
        try {
            $limit = min((int) $request->get('limit', 10), 50);

            $returnedByCategory = DB::table('returns_items')
                ->join('returns', 'returns_items.return_id', '=', 'returns.id')
                ->join('products', 'returns_items.product_id', '=', 'products.id')
                ->join('categories', 'products.category_id', '=', 'categories.id')
                ->whereIn('returns.status', ['approved', 'completed'])
                ->whereNotNull('products.category_id')
                ->groupBy('categories.id', 'categories.name')
                ->select(
                    'categories.id',
                    'categories.name',
                    DB::raw('SUM(returns_items.quantity_returned) as returned_units')
                )
                ->orderByDesc('returned_units')
                ->limit($limit)
                ->get();

            if ($returnedByCategory->isEmpty()) {
                $returnedByCategory = DB::table('returns')
                    ->join('sales', 'returns.sale_id', '=', 'sales.id')
                    ->join('sale_items', 'sale_items.sale_id', '=', 'sales.id')
                    ->join('products', 'sale_items.product_id', '=', 'products.id')
                    ->join('categories', 'products.category_id', '=', 'categories.id')
                    ->whereIn('returns.status', ['approved', 'completed'])
                    ->whereNotNull('products.category_id')
                    ->groupBy('categories.id', 'categories.name')
                    ->select(
                        'categories.id',
                        'categories.name',
                        DB::raw('SUM(sale_items.quantity) as returned_units')
                    )
                    ->orderByDesc('returned_units')
                    ->limit($limit)
                    ->get();
            }

            if ($returnedByCategory->isEmpty()) {
                return ['data' => [], 'status' => 'success'];
            }

            $topCategoryIds = $returnedByCategory->pluck('id')->toArray();

            $soldData = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->whereIn('products.category_id', $topCategoryIds)
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'confirmed', 'out_for_delivery', 'returned'])
                ->whereNotNull('products.category_id')
                ->groupBy('products.category_id')
                ->select('products.category_id', DB::raw('SUM(sale_items.quantity) as sold_units'))
                ->get()
                ->keyBy('category_id');

            $result = $returnedByCategory->map(function ($cat) use ($soldData) {
                $sold = $soldData->get($cat->id);
                $soldQty = $sold ? (int) $sold->sold_units : 0;
                $returnedQty = (int) $cat->returned_units;
                $rate = $soldQty > 0 ? floatval(number_format(($returnedQty / $soldQty) * 100, 2, '.', '')) : 0;
                return [
                    'id' => $cat->id,
                    'name' => $cat->name,
                    'returned_units' => $returnedQty,
                    'sold_units' => $soldQty,
                    'return_rate' => $rate,
                ];
            })->sortByDesc('return_rate')->values();

            return ['data' => $result, 'status' => 'success'];
        } catch (\Exception $e) {
            return [
                'error' => 'Failed to fetch return rate by category',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get inventory status report.
     */
    public function getInventoryReport($request)
    {
        $items = Inventory::with(['product.category'])
            ->join('products', 'inventory.product_id', '=', 'products.id')
            ->selectRaw('inventory.*, products.name, products.barcode')
            ->paginate($request->get('per_page', 20));

        return ['data' => $items, 'status' => 'success'];
    }

    /**
     * Get rating analytics.
     */
    public function getRatingAnalytics($request)
    {
        $period = $request->get('period', 'month');
        $from = now();
        $to = now();

        if ($period === 'week') {
            $from = now()->subDays(7);
        } elseif ($period === 'year') {
            $from = now()->subYear();
        } else {
            $from = now()->subDays(30);
        }

        $overallStats = [
            'total_ratings' => DB::table('deliveries')
                ->whereNotNull('rating')
                ->whereBetween('rated_at', [$from, $to])
                ->count(),
            'average_rating' => DB::table('deliveries')
                ->whereNotNull('rating')
                ->whereBetween('rated_at', [$from, $to])
                ->avg('rating'),
            'rating_distribution' => DB::table('deliveries')
                ->whereNotNull('rating')
                ->whereBetween('rated_at', [$from, $to])
                ->selectRaw('rating, COUNT(*) as count')
                ->groupBy('rating')
                ->pluck('count', 'rating')
                ->toArray(),
        ];

        $overallStats['average_rating'] = round($overallStats['average_rating'], 2);

        $totalRated = $overallStats['total_ratings'];
        $overallStats['rating_percentages'] = [];
        for ($i = 1; $i <= 5; $i++) {
            $count = $overallStats['rating_distribution'][$i] ?? 0;
            $overallStats['rating_percentages'][$i] = $totalRated > 0 ? round(($count / $totalRated) * 100, 1) : 0;
        }

        $riderRankings = DB::table('deliveries')
            ->join('users', 'deliveries.rider_id', '=', 'users.id')
            ->whereNotNull('deliveries.rating')
            ->whereBetween('deliveries.rated_at', [$from, $to])
            ->selectRaw('
                users.id as rider_id,
                users.name as rider_name,
                AVG(deliveries.rating) as average_rating,
                COUNT(deliveries.rating) as total_ratings,
                SUM(CASE WHEN deliveries.rating >= 4 THEN 1 ELSE 0 END) as positive_ratings,
                SUM(CASE WHEN deliveries.rating <= 2 THEN 1 ELSE 0 END) as negative_ratings
            ')
            ->groupBy('users.id', 'users.name')
            ->orderBy('average_rating', 'desc')
            ->orderBy('total_ratings', 'desc')
            ->get()
            ->map(function ($rider) {
                $rider->average_rating = round($rider->average_rating, 2);
                $rider->positive_rate = $rider->total_ratings > 0
                    ? round(($rider->positive_ratings / $rider->total_ratings) * 100, 1)
                    : 0;
                return $rider;
            });

        $topPerformers = $riderRankings->filter(function ($rider) {
            return $rider->total_ratings >= 5 && $rider->average_rating >= 4.0;
        })->take(20);

        $needsImprovement = $riderRankings->filter(function ($rider) {
            return $rider->total_ratings >= 5 && $rider->average_rating < 3.0;
        })->take(20);

        $ratingTrends = DB::table('deliveries')
            ->whereNotNull('rating')
            ->whereBetween('rated_at', [$from, $to])
            ->selectRaw('DATE(rated_at) as date, AVG(rating) as average_rating, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(function ($trend) {
                $trend->average_rating = round($trend->average_rating, 2);
                return $trend;
            });

        $recentFeedback = DB::table('deliveries')
            ->join('users as riders', 'deliveries.rider_id', '=', 'riders.id')
            ->join('sales', 'deliveries.sale_id', '=', 'sales.id')
            ->join('users as customers', 'sales.customer_id', '=', 'customers.id')
            ->whereNotNull('deliveries.rating')
            ->whereBetween('deliveries.rated_at', [$from, $to])
            ->selectRaw('
                deliveries.id,
                deliveries.rating,
                deliveries.rating_comment,
                deliveries.rated_at,
                riders.name as rider_name,
                customers.name as customer_name,
                deliveries.tracking_number
            ')
            ->orderBy('deliveries.rated_at', 'desc')
            ->limit(20)
            ->get();

        return [
            'data' => [
                'overall_stats' => $overallStats,
                'rider_rankings' => $riderRankings,
                'top_performers' => $topPerformers,
                'needs_improvement' => $needsImprovement,
                'rating_trends' => $ratingTrends,
                'recent_feedback' => $recentFeedback,
                'period' => $period,
                'date_range' => [
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                ],
            ],
            'status' => 'success',
        ];
    }

    public function getRatingAnalyticsRankings($request)
    {
        $period = $request->get('period', 'month');
        $from = now();
        $to = now();

        if ($period === 'week') {
            $from = now()->subDays(7);
        } elseif ($period === 'year') {
            $from = now()->subYear();
        } else {
            $from = now()->subDays(30);
        }

        $query = DB::table('deliveries')
            ->join('users', 'deliveries.rider_id', '=', 'users.id')
            ->whereNotNull('deliveries.rating')
            ->whereBetween('deliveries.rated_at', [$from, $to])
            ->selectRaw('
                users.id as rider_id,
                users.name as rider_name,
                AVG(deliveries.rating) as average_rating,
                COUNT(deliveries.rating) as total_ratings,
                SUM(CASE WHEN deliveries.rating >= 4 THEN 1 ELSE 0 END) as positive_ratings,
                SUM(CASE WHEN deliveries.rating <= 2 THEN 1 ELSE 0 END) as negative_ratings
            ')
            ->groupBy('users.id', 'users.name')
            ->orderBy('average_rating', 'desc')
            ->orderBy('total_ratings', 'desc');

        if ($request->search) {
            $query->where('users.name', 'like', "%{$request->search}%");
        }

        $rankings = $query->paginate($request->get('per_page', 20));

        $rankings->getCollection()->transform(function ($rider) {
            $rider->average_rating = round($rider->average_rating, 2);
            $rider->positive_rate = $rider->total_ratings > 0
                ? round(($rider->positive_ratings / $rider->total_ratings) * 100, 1)
                : 0;
            return $rider;
        });

        return $rankings;
    }

    public function getRatingAnalyticsFeedback($request)
    {
        $period = $request->get('period', 'month');
        $from = now();
        $to = now();

        if ($period === 'week') {
            $from = now()->subDays(7);
        } elseif ($period === 'year') {
            $from = now()->subYear();
        } else {
            $from = now()->subDays(30);
        }

        $query = DB::table('deliveries')
            ->join('users as riders', 'deliveries.rider_id', '=', 'riders.id')
            ->join('sales', 'deliveries.sale_id', '=', 'sales.id')
            ->join('users as customers', 'sales.customer_id', '=', 'customers.id')
            ->whereNotNull('deliveries.rating')
            ->whereBetween('deliveries.rated_at', [$from, $to])
            ->selectRaw('
                deliveries.id,
                deliveries.rating,
                deliveries.rating_comment,
                deliveries.rated_at,
                riders.name as rider_name,
                customers.name as customer_name,
                deliveries.tracking_number
            ')
            ->orderBy('deliveries.rated_at', 'desc');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('customers.name', 'like', "%{$request->search}%")
                    ->orWhere('riders.name', 'like', "%{$request->search}%")
                    ->orWhere('deliveries.tracking_number', 'like', "%{$request->search}%");
            });
        }

        $feedback = $query->paginate($request->get('per_page', 20));

        return $feedback;
    }

    /**
     * Get customer behavior analytics.
     */
    public function getCustomerBehavior($request)
    {
        $period = $request->get('period', 'month');
        $from = $period === 'week' ? now()->subDays(7) : ($period === 'year' ? now()->subYear() : now()->subDays(30));

        $newCustomers = DB::table('users')
            ->where('role', 'customer')
            ->whereBetween('created_at', [$from, now()])
            ->count();

        $returningCustomers = DB::table('sales')
            ->select('customer_id')
            ->whereBetween('created_at', [$from, now()])
            ->groupBy('customer_id')
            ->havingRaw('COUNT(*) > 1')
            ->get()
            ->count();

        $customerLTV = DB::table('sales')
            ->join('users', 'sales.customer_id', '=', 'users.id')
            ->select('users.id', 'users.name', 'users.email', DB::raw('SUM(sales.total_amount) as lifetime_value'), DB::raw('COUNT(sales.id) as total_orders'))
            ->groupBy('users.id', 'users.name', 'users.email')
            ->orderBy('lifetime_value', 'desc')
            ->limit(10)
            ->get();

        $purchaseFrequency = DB::table('sales')
            ->whereBetween('created_at', [$from, now()])
            ->selectRaw('COUNT(*) / COUNT(DISTINCT customer_id) as avg_orders_per_customer')
            ->value('avg_orders_per_customer');

        $totalReservations = DB::table('cart_reservations')->whereBetween('created_at', [$from, now()])->count();
        $convertedReservations = DB::table('cart_reservations')->where('status', 'converted')->whereBetween('created_at', [$from, now()])->count();
        $abandonmentRate = $totalReservations > 0 ? round((($totalReservations - $convertedReservations) / $totalReservations) * 100, 1) : 0;

        return [
            'data' => [
                'new_customers' => $newCustomers,
                'returning_customers' => $returningCustomers,
                'customer_ltv' => $customerLTV,
                'avg_purchase_frequency' => round($purchaseFrequency ?? 0, 2),
                'cart_abandonment_rate' => $abandonmentRate,
                'period' => $period,
            ],
            'status' => 'success',
        ];
    }

    /**
     * Get profit margins analysis.
     */
    public function getProfitMargins($request)
    {
        $period = $request->get('period', 'month');
        $from = $period === 'week' ? now()->subDays(7) : ($period === 'year' ? now()->subYear() : now()->subDays(30));

        $productProfit = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->whereBetween('sales.created_at', [$from, now()])
            ->whereIn('sales.status', ['delivered', 'pending', 'confirmed'])
            ->select(
                'products.id',
                'products.name',
                DB::raw('SUM(sale_items.quantity) as units_sold'),
                DB::raw('SUM(sale_items.quantity * sale_items.unit_price) as revenue'),
                DB::raw('SUM(sale_items.quantity * products.purchase_price) as cogs'),
                DB::raw('SUM(sale_items.quantity * sale_items.unit_price) - SUM(sale_items.quantity * products.purchase_price) as profit'),
                DB::raw('((SUM(sale_items.quantity * sale_items.unit_price) - SUM(sale_items.quantity * products.purchase_price)) / SUM(sale_items.quantity * sale_items.unit_price)) * 100 as profit_margin')
            )
            ->groupBy('products.id', 'products.name')
            ->orderBy('profit', 'desc')
            ->limit(20)
            ->get()
            ->map(function ($item) {
                $item->profit_margin = round($item->profit_margin, 2);
                $item->profit = round($item->profit, 2);
                $item->revenue = round($item->revenue, 2);
                $item->cogs = round($item->cogs, 2);
                return $item;
            });

        $categoryProfit = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->join('categories', 'products.category_id', '=', 'categories.id')
            ->whereBetween('sales.created_at', [$from, now()])
            ->whereIn('sales.status', ['delivered', 'pending', 'confirmed'])
            ->select(
                'categories.id',
                'categories.name',
                DB::raw('SUM(sale_items.quantity * sale_items.unit_price) as revenue'),
                DB::raw('SUM(sale_items.quantity * products.purchase_price) as cogs'),
                DB::raw('SUM(sale_items.quantity * sale_items.unit_price) - SUM(sale_items.quantity * products.purchase_price) as profit'),
                DB::raw('((SUM(sale_items.quantity * sale_items.unit_price) - SUM(sale_items.quantity * products.purchase_price)) / SUM(sale_items.quantity * sale_items.unit_price)) * 100 as profit_margin')
            )
            ->groupBy('categories.id', 'categories.name')
            ->orderBy('profit', 'desc')
            ->get()
            ->map(function ($item) {
                $item->profit_margin = round($item->profit_margin, 2);
                $item->profit = round($item->profit, 2);
                $item->revenue = round($item->revenue, 2);
                $item->cogs = round($item->cogs, 2);
                return $item;
            });

        $totalRevenue = $productProfit->sum('revenue');
        $totalCOGS = $productProfit->sum('cogs');
        $totalProfit = $totalRevenue - $totalCOGS;
        $overallMargin = $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 2) : 0;

        return [
            'data' => [
                'product_profit' => $productProfit,
                'category_profit' => $categoryProfit,
                'summary' => [
                    'total_revenue' => round($totalRevenue, 2),
                    'total_cogs' => round($totalCOGS, 2),
                    'total_profit' => round($totalProfit, 2),
                    'overall_margin' => $overallMargin,
                ],
                'period' => $period,
            ],
            'status' => 'success',
        ];
    }

    /**
     * Get recent activity.
     */
    public function getRecentActivity()
    {
        try {
            $activities = [];

            $sales = Sale::with(['customer', 'items.product', 'delivery'])
                ->latest()
                ->limit(15)
                ->get();

            foreach ($sales as $sale) {
                $status = 'Processing';
                $icon = 'ShoppingBag';
                $badgeVariant = 'secondary';

                switch ($sale->status) {
                    case 'delivered':
                        $status = 'Delivered';
                        $icon = 'CheckCircle';
                        $badgeVariant = 'success';
                        break;
                    case 'out_for_delivery':
                        $status = 'In Transit';
                        $icon = 'Bike';
                        $badgeVariant = 'blue';
                        break;
                    case 'confirmed':
                        $status = 'Processing';
                        $icon = 'Package';
                        $badgeVariant = 'blue';
                        break;
                    case 'cancelled':
                    case 'failed':
                        $status = 'Alert';
                        $icon = 'AlertTriangle';
                        $badgeVariant = 'destructive';
                        break;
                    case 'returned':
                        $status = 'Alert';
                        $icon = 'RefreshCcw';
                        $badgeVariant = 'amber';
                        break;
                    case 'pending_payment':
                    case 'verifying_payment':
                        $status = 'Warning';
                        $icon = 'Clock';
                        $badgeVariant = 'amber';
                        break;
                    case 'paid':
                        $status = 'Paid';
                        $icon = 'Check';
                        $badgeVariant = 'success';
                        break;
                    default:
                        $status = 'Processing';
                        $icon = 'ShoppingBag';
                        $badgeVariant = 'secondary';
                }

                $activities[] = [
                    'id' => 'sale-' . $sale->id,
                    'type' => 'sale',
                    'status' => $status,
                    'badgeVariant' => $badgeVariant,
                    'icon' => $icon,
                    'title' => "Order #{$sale->order_number}",
                    'message' => (optional($sale->customer)->name ?? 'A customer') . " - " . number_format($sale->total_amount, 2) . " PHP",
                    'timestamp' => ($sale->created_at ?? $sale->updated_at ?? now())->toIso8601String(),
                ];
            }

            $lowStock = Inventory::with('product')
                ->where('is_low_stock', 1)
                ->limit(5)
                ->get();

            foreach ($lowStock as $inv) {
                $stockVal = (int) round($inv->current_stock);
                $stockSuffix = $stockVal === 1 ? 'pc' : 'pcs';
                $isOutOfStock = $stockVal <= 0;
                $activities[] = [
                    'id' => 'stock-' . $inv->id,
                    'type' => 'inventory',
                    'status' => $isOutOfStock ? 'Alert' : 'Warning',
                    'badgeVariant' => $isOutOfStock ? 'red' : 'amber',
                    'icon' => 'AlertTriangle',
                    'title' => $isOutOfStock ? 'Out of Stock' : 'Stock Alert',
                    'message' => ($inv->product->name ?? 'Product') . ($isOutOfStock
                        ? ' is out of stock!'
                        : " is low on stock ({$stockVal}{$stockSuffix} remaining)"),
                    'timestamp' => ($inv->updated_at ?? $inv->last_adjusted_at ?? $inv->created_at ?? now())->toIso8601String(),
                ];
            }

            usort($activities, function ($a, $b) {
                return strtotime($b['timestamp']) - strtotime($a['timestamp']);
            });

            return [
                'data' => array_slice($activities, 0, 15),
                'status' => 'success',
            ];
        } catch (\Exception $e) {
            return [
                'error' => 'Failed to fetch activity',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get inventory forecast.
     */
    public function getInventoryForecast($request)
    {
        $salesVelocity = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->whereBetween('sales.created_at', [now()->subDays(30), now()])
            ->whereIn('sales.status', ['delivered', 'pending', 'confirmed'])
            ->select(
                'products.id',
                'products.name',
                DB::raw('SUM(sale_items.quantity) as units_sold_30d'),
                DB::raw('SUM(sale_items.quantity) / 30 as daily_velocity')
            )
            ->groupBy('products.id', 'products.name')
            ->get();

        $forecast = [];
        foreach ($salesVelocity as $item) {
            $inventory = DB::table('inventory')
                ->where('product_id', $item->id)
                ->whereNull('product_variant_id')
                ->first();

            $currentStock = $inventory ? $inventory->current_stock : 0;
            $daysUntilStockout = $item->daily_velocity > 0 ? round($currentStock / $item->daily_velocity) : 999;

            $forecast[] = [
                'product_id' => $item->id,
                'product_name' => $item->name,
                'current_stock' => $currentStock,
                'daily_velocity' => round($item->daily_velocity, 2),
                'units_sold_30d' => $item->units_sold_30d,
                'days_until_stockout' => $daysUntilStockout,
                'predicted_stockout_date' => $daysUntilStockout < 999 ? now()->addDays($daysUntilStockout)->toDateString() : null,
                'status' => $daysUntilStockout <= 7 ? 'critical' : ($daysUntilStockout <= 14 ? 'warning' : 'ok'),
            ];
        }

        usort($forecast, function ($a, $b) {
            return $a['days_until_stockout'] <=> $b['days_until_stockout'];
        });

        $salesData = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.created_at', '>=', now()->subDays(30))
            ->select('product_id', DB::raw('SUM(quantity) as sold'))
            ->groupBy('product_id');

        $slowMoving = DB::table('inventory')
            ->join('products', 'inventory.product_id', '=', 'products.id')
            ->leftJoinSub($salesData, 'sales_data', 'products.id', '=', 'sales_data.product_id')
            ->select('products.id', 'products.name', 'inventory.current_stock', DB::raw('COALESCE(sales_data.sold, 0) as units_sold'))
            ->whereNull('inventory.product_variant_id')
            ->where('inventory.current_stock', '>', 0)
            ->havingRaw('units_sold < 5')
            ->orderBy('units_sold')
            ->limit(20)
            ->get();

        return [
            'data' => [
                'forecast' => array_slice($forecast, 0, 20),
                'slow_moving' => $slowMoving,
                'critical_count' => count(array_filter($forecast, fn($f) => $f['status'] === 'critical')),
                'warning_count' => count(array_filter($forecast, fn($f) => $f['status'] === 'warning')),
            ],
            'status' => 'success',
        ];
    }
}
