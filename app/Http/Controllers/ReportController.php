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
        } elseif ($period === 'year') {
            $from = now()->subYear();
        } else { // month
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
                    'total_revenue'        => round($totalRevenue, 2),
                    'total_orders'         => $totalOrders,
                    'average_order_value'  => round($avgOrderValue, 2),
                    'delivered_orders'     => $summaryData->delivered_orders ?? 0,
                    'pending_orders'       => $summaryData->pending_orders ?? 0,
                    'in_progress_orders'     => $summaryData->in_progress_orders ?? 0,
                    'failed_orders'          => $summaryData->failed_orders ?? 0,
                    'returned_orders'        => $summaryData->returned_orders ?? 0,
                    'cod_revenue'            => $summaryData->cod_revenue ?? 0,
                    'cod_orders'             => $summaryData->cod_orders ?? 0,
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
            } elseif ($period === 'year') {
                $from = now()->subYear();
            } elseif ($period === 'quarter') {
                $from = now()->subDays(90);
            } else { // month
                $from = now()->subDays(30);
            }

            $topProducts = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->whereBetween(DB::raw('DATE(sales.created_at)'), [$from->toDateString(), $to->toDateString()])
                ->whereIn('sales.status', ['delivered', 'in_progress', 'pending'])
                ->select(
                    'products.id',
                    'products.name',
                    'products.sku',
                    DB::raw('SUM(sale_items.quantity) as total_sold'),
                    DB::raw('SUM(sale_items.quantity * sale_items.unit_price) as revenue')
                )
                ->groupBy('products.id', 'products.name', 'products.sku')
                ->orderByDesc('total_sold')
                ->limit(10)
                ->get();

            return response()->json([
                'data' => $topProducts,
                'status' => 'success'
            ]);
        } catch (\Exception $e) {
            \Log::error('Top Products Query Error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch top products',
                'message' => 'Database query failed: ' . $e->getMessage()
            ], 500);
        }
    }

    public function inventory(Request $request)
    {
        $items = Inventory::with(['product.category'])
            ->join('products', 'inventory.product_id', '=', 'products.id')
            ->selectRaw('inventory.*, products.name, products.sku')
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
        } elseif ($period === 'year') {
            $from = now()->subYear();
        } else { // month
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
                'Content-Type'        => 'text/csv',
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

            } catch (\Exception $e) {
                // Log the error for debugging
                \Log::error('PDF Generation Error: ' . $e->getMessage());
                \Log::error('PDF Error Stack: ' . $e->getTraceAsString());

                // Return error response
                return response()->json([
                    'error' => 'Failed to generate PDF report',
                    'message' => 'An error occurred while generating the PDF. Please try again or contact support.'
                ], 500);
            }
        }

        return response()->json([
            'data'   => $sales,
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
}
