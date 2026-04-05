<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Dompdf\Dompdf;
use Dompdf\Options;

class ReportController extends Controller
{
    public function sales(Request $request)
    {
        $period = $request->get('period', 'month');
        $from = now();
        $to = now();

        if ($period === 'week') {
            $from = now()->subDays(7);
        }
        elseif ($period === 'year') {
            $from = now()->subYear();
        }
        else { // month
            $from = now()->subDays(30);
        }

        $sales = Sale::whereBetween(DB::raw('DATE(created_at)'), [$from->toDateString(), $to->toDateString()])
            ->selectRaw('DATE(created_at) as date, SUM(total_amount) as revenue')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $summaryData = Sale::whereBetween(DB::raw('DATE(created_at)'), [$from->toDateString(), $to->toDateString()])
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(CASE WHEN status = "delivered" THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN status = "returned" THEN 1 ELSE 0 END) as returned_orders,
                SUM(CASE WHEN status = "in_progress" THEN 1 ELSE 0 END) as in_progress_orders,
                SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed_orders,
                SUM(CASE WHEN payment_method = "cod" THEN total_amount ELSE 0 END) as cod_revenue,
                SUM(CASE WHEN payment_method = "cod" THEN 1 ELSE 0 END) as cod_orders
            ')->first();

        $totalRevenue = $summaryData->total_revenue ?? 0;
        $totalOrders = $summaryData->total_orders ?? 0;
        $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        return response()->json([
            'data' => [
                'chart_data' => $sales,
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
                ]
            ],
            'status' => 'success',
        ]);
    }

    public function topProducts(Request $request)
    {
        try {
            $period = $request->get('period', 'month');
            $from = now();
            $to = now();

            if ($period === 'week') {
                $from = now()->subDays(7);
            }
            elseif ($period === 'year') {
                $from = now()->subYear();
            }
            elseif ($period === 'quarter') {
                $from = now()->subDays(90);
            }
            else { // month
                $from = now()->subDays(30);
            }

            $topProducts = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->whereBetween(DB::raw('DATE(sales.created_at)'), [$from->toDateString(), $to->toDateString()])
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

            return response()->json([
                'data' => $topProducts,
                'status' => 'success'
            ]);
        }
        catch (\Exception $e) {
            \Log::error('Top Products Query Error', ['message' => $e->getMessage()]);
            return response()->json([
                'error' => 'Failed to fetch top products',
                'message' => 'Database query failed: ' . $e->getMessage()
            ], 500);
        }
    }

    public function categorySales(Request $request)
    {
        try {
            $period = $request->get('period', 'month');
            $limit = min((int) $request->get('limit', 10), 50);

            // Calculate current and previous period ranges
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
                default: // month
                    $currentFrom = now()->subDays(30)->toDateString();
                    $currentTo = now()->toDateString();
                    $previousFrom = now()->subDays(60)->toDateString();
                    $previousTo = now()->subDays(30)->toDateString();
                    $periodLabel = 'This Month';
                    $prevLabel = 'Last Month';
                    break;
            }

            // Get top N categories by current period revenue
            $topCategoryIds = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->whereBetween(DB::raw('DATE(sales.created_at)'), [$currentFrom, $currentTo])
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'confirmed', 'out_for_delivery', 'returned'])
                ->whereNotNull('products.category_id')
                ->groupBy('products.category_id')
                ->orderByRaw('SUM(sale_items.quantity * sale_items.unit_price) DESC')
                ->limit($limit)
                ->pluck('products.category_id');

            if ($topCategoryIds->isEmpty()) {
                return response()->json([
                    'data' => [
                        'categories' => [],
                        'period_label' => $periodLabel,
                        'prev_label' => $prevLabel,
                        'total_categories' => 0,
                    ],
                    'status' => 'success'
                ]);
            }

            // Current period data
            $currentData = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('categories', 'products.category_id', '=', 'categories.id')
                ->whereBetween(DB::raw('DATE(sales.created_at)'), [$currentFrom, $currentTo])
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

            // Previous period data
            $previousData = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->whereIn('products.category_id', $topCategoryIds)
                ->whereBetween(DB::raw('DATE(sales.created_at)'), [$previousFrom, $previousTo])
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'confirmed', 'out_for_delivery', 'returned'])
                ->groupBy('products.category_id')
                ->select(
                    'products.category_id as id',
                    DB::raw('SUM(sale_items.quantity * sale_items.unit_price) as revenue'),
                    DB::raw('SUM(sale_items.quantity) as units_sold')
                )
                ->get()
                ->keyBy('id');

            // Total category count
            $totalCategories = DB::table('products')
                ->whereNotNull('category_id')
                ->distinct('category_id')
                ->count('category_id');

            // Merge into result
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

            // Sort by current revenue descending
            usort($categories, function ($a, $b) {
                return $b['current_revenue'] - $a['current_revenue'];
            });

            return response()->json([
                'data' => [
                    'categories' => $categories,
                    'period_label' => $periodLabel,
                    'prev_label' => $prevLabel,
                    'total_categories' => $totalCategories,
                ],
                'status' => 'success'
            ]);
        } catch (\Exception $e) {
            \Log::error('Category Sales Error', ['message' => $e->getMessage()]);
            return response()->json([
                'error' => 'Failed to fetch category sales',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function yearlyCategoryRevenue(Request $request)
    {
        try {
            $year  = (int) $request->get('year', now()->year);
            $limit = min((int) $request->get('limit', 10), 50);

            $from = "{$year}-01-01";
            $to   = "{$year}-12-31";

            $categories = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('categories', 'products.category_id', '=', 'categories.id')
                ->whereBetween(DB::raw('DATE(sales.created_at)'), [$from, $to])
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

            return response()->json([
                'data'   => ['categories' => $categories, 'year' => $year],
                'status' => 'success',
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch yearly category revenue', 'message' => $e->getMessage()], 500);
        }
    }

    public function returnRateByCategory(Request $request)
    {
        try {
            $limit = min((int) $request->get('limit', 10), 50);

            $returnData = DB::table('return_order_items')
                ->join('return_orders', 'return_order_items.return_order_id', '=', 'return_orders.id')
                ->join('products', 'return_order_items.product_id', '=', 'products.id')
                ->join('categories', 'products.category_id', '=', 'categories.id')
                ->whereIn('return_orders.status', ['approved', 'completed'])
                ->whereNotNull('products.category_id')
                ->groupBy('categories.id', 'categories.name')
                ->orderByRaw('SUM(return_order_items.quantity) DESC')
                ->limit($limit)
                ->select(
                    'categories.id',
                    'categories.name',
                    DB::raw('SUM(return_order_items.quantity) as returned_units')
                )
                ->get();

            $soldData = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('categories', 'products.category_id', '=', 'categories.id')
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending', 'confirmed', 'out_for_delivery', 'returned'])
                ->whereNotNull('products.category_id')
                ->groupBy('categories.id')
                ->select('categories.id', DB::raw('SUM(sale_items.quantity) as sold_units'))
                ->get()
                ->keyBy('id');

            $result = $returnData->map(function ($cat) use ($soldData) {
                $sold    = $soldData->get($cat->id);
                $soldQty = $sold ? (int) $sold->sold_units : 0;
                $rate    = $soldQty > 0 ? round(($cat->returned_units / $soldQty) * 100, 1) : 0;
                return [
                    'id'             => $cat->id,
                    'name'           => $cat->name,
                    'returned_units' => (int) $cat->returned_units,
                    'sold_units'     => $soldQty,
                    'return_rate'    => $rate,
                ];
            })->sortByDesc('return_rate')->values();

            return response()->json(['data' => $result, 'status' => 'success']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch return rate by category', 'message' => $e->getMessage()], 500);
        }
    }

    public function inventory(Request $request)
    {
        $items = Inventory::with(['product.category'])
            ->join('products', 'inventory.product_id', '=', 'products.id')
            ->selectRaw('inventory.*, products.name, products.barcode')
            ->paginate($request->get('per_page', 20));

        return response()->json(['data' => $items, 'status' => 'success']);
    }

    public function export(Request $request)
    {
        $type = $request->get('type', 'csv');
        $period = $request->get('period', 'month');
        $from = now();
        $to = now();

        if ($period === 'week') {
            $from = now()->subDays(7);
        }
        elseif ($period === 'year') {
            $from = now()->subYear();
        }
        else { // month
            $from = now()->subDays(30);
        }

        $sales = Sale::with(['customer', 'items.product'])
            ->whereBetween(DB::raw('DATE(created_at)'), [$from->toDateString(), $to->toDateString()])
            ->get();

        $summaryData = Sale::whereBetween(DB::raw('DATE(created_at)'), [$from->toDateString(), $to->toDateString()])
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(CASE WHEN status = "delivered" THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN status = "in_progress" THEN 1 ELSE 0 END) as in_progress_orders,
                SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed_orders
            ')->first();

        $totalRevenue = $summaryData->total_revenue ?? 0;
        $totalOrders = $summaryData->total_orders ?? 0;
        $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        if ($type === 'csv') {
            $csv = "Order Number,Customer,Total,Status,Payment Method,Date\n";
            foreach ($sales as $sale) {
                $paymentMethod = $sale->payment_method === 'cod' ? 'Cash on Delivery' : $sale->payment_method;
                $csv .= "\"{$sale->order_number}\",\"{$sale->customer->name}\",{$sale->total_amount},{$sale->status},{$paymentMethod},{$sale->created_at}\n";
            }

            return response($csv, 200, [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"sales_report_{$period}_" . now()->toDateString() . ".csv\"",
            ]);
        }

        // PDF Generation with Company Branding using dompdf
        if ($type === 'pdf') {
            try {
                $html = $this->generatePDFTemplate([
                    'period' => $period,
                    'period_label' => $this->getPeriodLabel($period),
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'generated_at' => now()->toDateTimeString(),
                    'sales' => $sales,
                    'summary' => [
                        'total_revenue' => $totalRevenue,
                        'total_orders' => $totalOrders,
                        'average_order_value' => $avgOrderValue,
                        'delivered_orders' => $summaryData->delivered_orders ?? 0,
                        'pending_orders' => $summaryData->pending_orders ?? 0,
                        'in_progress_orders' => $summaryData->in_progress_orders ?? 0,
                        'failed_orders' => $summaryData->failed_orders ?? 0,
                    ]
                ]);

                // Configure dompdf options
                $options = new Options();
                $options->set('defaultFont', 'Arial');
                $options->set('isHtml5ParserEnabled', false); // Disable to avoid issues
                $options->set('isRemoteEnabled', false); // Disable remote content

                // Create dompdf instance
                $dompdf = new Dompdf($options);

                // Load HTML content
                $dompdf->loadHtml($html);

                // Set paper size and orientation
                $dompdf->setPaper('A4', 'portrait');

                // Render PDF
                $dompdf->render();

                // Get PDF content as string
                $pdfContent = $dompdf->output();

                // Return PDF as download
                $filename = "sales_report_{$period}_" . now()->toDateString() . '.pdf';
                return response($pdfContent, 200, [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                ]);

            }
            catch (\Exception $e) {
                // Log the error for debugging
                \Log::error('PDF Generation Error', ['message' => $e->getMessage()]);
                \Log::error('PDF Error Stack', ['trace' => $e->getTraceAsString()]);

                // Return error response
                return response()->json([
                    'error' => 'Failed to generate PDF report',
                    'message' => 'An error occurred while generating the PDF. Please try again or contact support.'
                ], 500);
            }
        }

        return response()->json([
            'data' => $sales,
            'status' => 'success',
        ]);
    }

    private function getPeriodLabel($period)
    {
        $labels = [
            'week' => 'Last 7 Days',
            'month' => 'Last 30 Days',
            'quarter' => 'Last Quarter',
            'year' => 'Last 12 Months'
        ];
        return $labels[$period] ?? 'Custom Period';
    }

    private function generatePDFTemplate($data)
    {
        $summary = $data['summary'];
        $sales = $data['sales'];
        $periodLabel = $data['period_label'];
        $generatedAt = $data['generated_at'];

        $html = '
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Sales Report - ' . $periodLabel . '</title>
    <style>
        * { margin: 0; padding: 0; }
        body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-size: 11px;
            line-height: 1.5; 
            color: #333;
            background: #fff;
        }
        .container { width: 100%; padding: 15px; }
        
        /* Company Header */
        .company-header {
            text-align: center;
            padding: 15px 0;
            border-bottom: 3px solid #2c3e50;
            margin-bottom: 20px;
        }
        .logo-box {
            display: inline-block;
            background: #2c3e50;
            color: #fff;
            padding: 8px 20px;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .company-name {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 2px;
        }
        .company-tagline {
            font-size: 12px;
            color: #666;
            font-weight: 600;
        }
        .company-info {
            font-size: 10px;
            color: #777;
            margin-top: 8px;
        }
        
        /* Report Header */
        .report-header {
            text-align: center;
            margin-bottom: 20px;
            padding: 10px 0;
            background: #f5f5f5;
            border-radius: 4px;
        }
        .report-title {
            font-size: 16px;
            font-weight: 700;
            color: #2c3e50;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .report-meta {
            font-size: 10px;
            color: #666;
            margin-top: 5px;
        }
        
        /* Summary Section */
        .summary-section {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 15px;
        }
        .section-title {
            font-size: 11px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
        }
        .summary-table td {
            padding: 10px;
            text-align: center;
            width: 33.33%;
            border-right: 1px solid #e0e0e0;
        }
        .summary-table td:last-child {
            border-right: none;
        }
        .summary-label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 3px;
        }
        .summary-value {
            font-size: 16px;
            font-weight: 700;
        }
        .text-green { color: #27ae60; }
        .text-blue { color: #3498db; }
        .text-purple { color: #9b59b6; }
        
        /* Status Table */
        .status-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .status-table td {
            width: 25%;
            padding: 8px;
            text-align: center;
            border: 1px solid #e0e0e0;
        }
        .status-box {
            padding: 8px;
            background: #f8f9fa;
            border-radius: 3px;
        }
        .status-box.delivered { border-left: 3px solid #27ae60; }
        .status-box.pending { border-left: 3px solid #f39c12; }
        .status-box.in-progress { border-left: 3px solid #3498db; }
        .status-box.failed { border-left: 3px solid #e74c3c; }
        .status-count {
            font-size: 14px;
            font-weight: 700;
            color: #2c3e50;
        }
        .status-label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
        }
        
        /* Orders Table */
        .orders-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            margin-top: 8px;
        }
        .orders-table th {
            background: #34495e;
            color: #fff;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 9px;
        }
        .orders-table td {
            padding: 6px;
            border-bottom: 1px solid #e0e0e0;
            vertical-align: middle;
        }
        .orders-table tr:nth-child(even) { background: #f9f9f9; }
        .order-number { font-weight: 600; color: #2c3e50; }
        .order-total { font-weight: 600; color: #27ae60; }
        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-delivered { background: #d4edda; color: #155724; }
        .badge-pending { background: #fff3cd; color: #856404; }
        .badge-in-progress { background: #cce5ff; color: #004085; }
        .badge-failed { background: #f8d7da; color: #721c24; }
        
        /* Footer */
        .report-footer {
            text-align: center;
            padding-top: 15px;
            margin-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 9px;
            color: #999;
        }
        .footer-text {
            margin-bottom: 3px;
        }
        .footer-disclaimer {
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Company Header -->
        <div class="company-header">
            <div class="logo-box">
                <div class="company-name">HRMS</div>
            </div>
            <div class="company-tagline">HR Multi-System</div>
            <div class="company-info">
                Order Management & Sales Report System<br>
                Davao City, Philippines | support@hrms-system.com
            </div>
        </div>
        
        <!-- Report Header -->
        <div class="report-header">
            <div class="report-title">SALES PERFORMANCE REPORT</div>
            <div class="report-meta">
                Period: <strong>' . $periodLabel . '</strong> | Generated: <strong>' . $generatedAt . '</strong>
            </div>
        </div>
        
        <!-- Executive Summary -->
        <div class="summary-section">
            <div class="section-title">Executive Summary</div>
            <table class="summary-table">
                <tr>
                    <td>
                        <div class="summary-label">Total Revenue</div>
                        <div class="summary-value text-green">PHP ' . number_format($summary['total_revenue'], 2) . '</div>
                    </td>
                    <td>
                        <div class="summary-label">Total Orders</div>
                        <div class="summary-value text-blue">' . number_format($summary['total_orders']) . '</div>
                    </td>
                    <td>
                        <div class="summary-label">Avg Order Value</div>
                        <div class="summary-value text-purple">PHP ' . number_format($summary['average_order_value'], 2) . '</div>
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- Status Breakdown -->
        <div class="summary-section">
            <div class="section-title">Order Status Breakdown</div>
            <table class="status-table">
                <tr>
                    <td>
                        <div class="status-box delivered">
                            <div class="status-count">' . number_format($summary['delivered_orders']) . '</div>
                            <div class="status-label">Delivered</div>
                        </div>
                    </td>
                    <td>
                        <div class="status-box pending">
                            <div class="status-count">' . number_format($summary['pending_orders']) . '</div>
                            <div class="status-label">Pending</div>
                        </div>
                    </td>
                    <td>
                        <div class="status-box in-progress">
                            <div class="status-count">' . number_format($summary['in_progress_orders']) . '</div>
                            <div class="status-label">In Progress</div>
                        </div>
                    </td>
                    <td>
                        <div class="status-box failed">
                            <div class="status-count">' . number_format($summary['failed_orders']) . '</div>
                            <div class="status-label">Failed</div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- Orders Detail -->
        <div class="summary-section">
            <div class="section-title">Order Details</div>
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>';

        foreach ($sales as $sale) {
            $statusClass = str_replace('_', '-', $sale->status);
            $badgeClass = str_replace('_', '-', $sale->status);
            $statusLabel = ucwords(str_replace('_', ' ', $sale->status));
            $html .= '
                    <tr>
                        <td class="order-number">' . $sale->order_number . '</td>
                        <td>' . ($sale->customer->name ?? 'Guest') . '</td>
                        <td class="order-total">PHP ' . number_format($sale->total_amount, 2) . '</td>
                        <td><span class="status-badge badge-' . $badgeClass . '">' . $statusLabel . '</span></td>
                        <td>' . $sale->created_at->format('M d, Y') . '</td>
                    </tr>';
        }

        $html .= '
                </tbody>
                <tfoot>
                    <tr style="background: #34495e; color: #fff;">
                        <td colspan="2" style="padding: 8px 6px; font-weight: 700; text-align: right;">TOTALS:</td>
                        <td style="padding: 8px 6px; font-weight: 700;">PHP ' . number_format($summary['total_revenue'], 2) . '</td>
                        <td colspan="2" style="padding: 8px 6px; font-weight: 700; text-align: center;">' . number_format($summary['total_orders']) . ' Orders</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        <!-- Footer -->
        <div class="report-footer">
            <div class="footer-text">This is an official sales report generated by HRMS</div>
            <div class="footer-disclaimer">Confidential - For internal use only</div>
        </div>
    </div>
</body>
</html>';

        return $html;
    }

    public function ratingAnalytics(Request $request)
    {
        $period = $request->get('period', 'month');
        $from = now();
        $to = now();

        if ($period === 'week') {
            $from = now()->subDays(7);
        }
        elseif ($period === 'year') {
            $from = now()->subYear();
        }
        else { // month
            $from = now()->subDays(30);
        }

        // Overall rating statistics
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

        // Round average rating
        $overallStats['average_rating'] = round($overallStats['average_rating'], 2);

        // Calculate rating percentages
        $totalRated = $overallStats['total_ratings'];
        $overallStats['rating_percentages'] = [];
        for ($i = 1; $i <= 5; $i++) {
            $count = $overallStats['rating_distribution'][$i] ?? 0;
            $overallStats['rating_percentages'][$i] = $totalRated > 0 ? round(($count / $totalRated) * 100, 1) : 0;
        }

        // Rider rankings
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

        // Top performers (5+ ratings, 4.0+ average)
        $topPerformers = $riderRankings->filter(function ($rider) {
            return $rider->total_ratings >= 5 && $rider->average_rating >= 4.0;
        })->take(10);

        // Needs improvement (5+ ratings, below 3.0 average)
        $needsImprovement = $riderRankings->filter(function ($rider) {
            return $rider->total_ratings >= 5 && $rider->average_rating < 3.0;
        })->take(10);

        // Rating trends over time
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

        // Recent feedback
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

        return response()->json([
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
                    'to' => $to->toDateString()
                ]
            ],
            'status' => 'success'
        ]);
    }

    public function ratingAnalyticsRankings(Request $request)
    {
        $period = $request->get('period', 'month');
        $from = now();
        $to = now();

        if ($period === 'week') {
            $from = now()->subDays(7);
        }
        elseif ($period === 'year') {
            $from = now()->subYear();
        }
        else { // month
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

        // Apply search if provided
        if ($request->search) {
            $query->where('users.name', 'like', "%{$request->search}%");
        }

        $rankings = $query->paginate($request->get('per_page', 15));

        // Calculate positive rate for each rider
        $rankings->getCollection()->transform(function ($rider) {
            $rider->average_rating = round($rider->average_rating, 2);
            $rider->positive_rate = $rider->total_ratings > 0
                ? round(($rider->positive_ratings / $rider->total_ratings) * 100, 1)
                : 0;
            return $rider;
        });

        return response()->json($rankings);
    }

    public function ratingAnalyticsFeedback(Request $request)
    {
        $period = $request->get('period', 'month');
        $from = now();
        $to = now();

        if ($period === 'week') {
            $from = now()->subDays(7);
        }
        elseif ($period === 'year') {
            $from = now()->subYear();
        }
        else { // month
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

        // Apply search if provided
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('customers.name', 'like', "%{$request->search}%")
                    ->orWhere('riders.name', 'like', "%{$request->search}%")
                    ->orWhere('deliveries.tracking_number', 'like', "%{$request->search}%");
            });
        }

        $feedback = $query->paginate($request->get('per_page', 15));

        return response()->json($feedback);
    }

    public function customerBehavior(Request $request)
    {
        $period = $request->get('period', 'month');
        $from = $period === 'week' ? now()->subDays(7) : ($period === 'year' ? now()->subYear() : now()->subDays(30));

        // New vs Returning Customers
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

        // Customer Lifetime Value (Top 10)
        $customerLTV = DB::table('sales')
            ->join('users', 'sales.customer_id', '=', 'users.id')
            ->select('users.id', 'users.name', 'users.email', DB::raw('SUM(sales.total_amount) as lifetime_value'), DB::raw('COUNT(sales.id) as total_orders'))
            ->groupBy('users.id', 'users.name', 'users.email')
            ->orderBy('lifetime_value', 'desc')
            ->limit(10)
            ->get();

        // Purchase Frequency
        $purchaseFrequency = DB::table('sales')
            ->whereBetween('created_at', [$from, now()])
            ->selectRaw('COUNT(*) / COUNT(DISTINCT customer_id) as avg_orders_per_customer')
            ->value('avg_orders_per_customer');

        // Cart Abandonment Rate (using cart reservations)
        $totalReservations = DB::table('cart_reservations')->whereBetween('created_at', [$from, now()])->count();
        $convertedReservations = DB::table('cart_reservations')->where('status', 'converted')->whereBetween('created_at', [$from, now()])->count();
        $abandonmentRate = $totalReservations > 0 ? round((($totalReservations - $convertedReservations) / $totalReservations) * 100, 1) : 0;

        return response()->json([
            'data' => [
                'new_customers' => $newCustomers,
                'returning_customers' => $returningCustomers,
                'customer_ltv' => $customerLTV,
                'avg_purchase_frequency' => round($purchaseFrequency ?? 0, 2),
                'cart_abandonment_rate' => $abandonmentRate,
                'period' => $period,
            ],
            'status' => 'success',
        ]);
    }

    public function inventoryForecast(Request $request)
    {
        // Get sales velocity for last 30 days
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

        // Get current inventory and calculate stockout dates
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

        // Sort by urgency
        usort($forecast, function ($a, $b) {
            return $a['days_until_stockout'] <=> $b['days_until_stockout'];
        });

        // Slow-moving inventory (less than 5 units sold in 30 days)
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

        return response()->json([
            'data' => [
                'forecast' => array_slice($forecast, 0, 20),
                'slow_moving' => $slowMoving,
                'critical_count' => count(array_filter($forecast, fn($f) => $f['status'] === 'critical')),
                'warning_count' => count(array_filter($forecast, fn($f) => $f['status'] === 'warning')),
            ],
            'status' => 'success',
        ]);
    }

    public function profitMargins(Request $request)
    {
        $period = $request->get('period', 'month');
        $from = $period === 'week' ? now()->subDays(7) : ($period === 'year' ? now()->subYear() : now()->subDays(30));

        // Profit by Product (Top 20)
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

        // Profit by Category
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

        // Overall Summary
        $totalRevenue = $productProfit->sum('revenue');
        $totalCOGS = $productProfit->sum('cogs');
        $totalProfit = $totalRevenue - $totalCOGS;
        $overallMargin = $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 2) : 0;

        return response()->json([
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
        ]);
    }
}
