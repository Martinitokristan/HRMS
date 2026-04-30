<?php

namespace App\Services\Reports;

use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Dompdf\Dompdf;
use Dompdf\Options;

class ReportExportService
{
    /**
     * Export report to PDF.
     */
    public function exportPDF($data, $reportType)
    {
        $from = $data['from'] ?? now()->startOfYear();
        $to = $data['to'] ?? now()->endOfYear();
        $type = $reportType;

        $startDate = is_string($from) ? Carbon::parse($from) : $from;
        $endDate = is_string($to) ? Carbon::parse($to) : $to;

        $sales = Sale::where('created_at', '>=', $startDate)
            ->where('created_at', '<=', $endDate)
            ->where('status', '!=', 'cancelled')
            ->with('customer', 'items.product')
            ->get();

        $totalRevenue = $sales->sum('total_amount');
        $totalOrders = $sales->count();
        $averageOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        $html = $this->generatePDFHTML([
            'type' => $type,
            'from' => $startDate->format('M d, Y'),
            'to' => $endDate->format('M d, Y'),
            'total_revenue' => number_format($totalRevenue, 2),
            'total_orders' => $totalOrders,
            'average_order_value' => number_format($averageOrderValue, 2),
            'sales' => $sales,
        ]);

        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isPhpEnabled', true);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return [
            'pdf' => $dompdf->output(),
            'filename' => "report-{$type}-" . now()->format('Ymd-His') . ".pdf",
            'status_code' => 200,
        ];
    }

    /**
     * Generate HTML for PDF report.
     */
    private function generatePDFHTML($data)
    {
        $type = $data['type'] ?? 'sales';
        $from = $data['from'] ?? 'N/A';
        $to = $data['to'] ?? 'N/A';
        $totalRevenue = $data['total_revenue'] ?? '0.00';
        $totalOrders = $data['total_orders'] ?? 0;
        $averageOrderValue = $data['average_order_value'] ?? '0.00';
        $sales = $data['sales'] ?? collect();

        $salesRows = '';
        foreach ($sales as $sale) {
            $itemsCount = $sale->items->count();
            $salesRows .= "
                <tr>
                    <td style='padding: 8px; border-bottom: 1px solid #ddd;'>{$sale->order_number}</td>
                    <td style='padding: 8px; border-bottom: 1px solid #ddd;'>{$sale->customer->name}</td>
                    <td style='padding: 8px; border-bottom: 1px solid #ddd;'>{$itemsCount}</td>
                    <td style='padding: 8px; border-bottom: 1px solid #ddd; text-align: right;'>₱" . number_format($sale->total_amount, 2) . "</td>
                    <td style='padding: 8px; border-bottom: 1px solid #ddd;'>{$sale->status}</td>
                </tr>
            ";
        }

        return "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='utf-8'>
                <title>Report Export</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { margin: 0; color: #1a1a1a; }
                    .header p { margin: 5px 0; color: #666; }
                    .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
                    .summary-item { text-align: center; padding: 15px; background: #f5f5f5; border-radius: 5px; flex: 1; margin: 0 10px; }
                    .summary-item h3 { margin: 0 0 10px 0; color: #666; font-size: 12px; text-transform: uppercase; }
                    .summary-item .value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #333; color: white; padding: 10px; text-align: left; font-weight: bold; }
                    td { padding: 8px; border-bottom: 1px solid #ddd; }
                    .footer { margin-top: 30px; text-align: center; color: #999; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class='header'>
                    <h1>Sales Report</h1>
                    <p>From: {$from} To: {$to}</p>
                </div>

                <div class='summary'>
                    <div class='summary-item'>
                        <h3>Total Revenue</h3>
                        <div class='value'>₱{$totalRevenue}</div>
                    </div>
                    <div class='summary-item'>
                        <h3>Total Orders</h3>
                        <div class='value'>{$totalOrders}</div>
                    </div>
                    <div class='summary-item'>
                        <h3>Avg Order Value</h3>
                        <div class='value'>₱{$averageOrderValue}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Order Number</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {$salesRows}
                    </tbody>
                </table>

                <div class='footer'>
                    <p>Generated on: " . now()->format('F d, Y H:i:s') . "</p>
                </div>
            </body>
            </html>
        ";
    }
}
