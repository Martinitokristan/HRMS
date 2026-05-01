<?php

namespace App\Http\Controllers;

use App\Services\Reports\ReportService;
use App\Services\Reports\ReportExportService;
use Illuminate\Http\Request;

class ReportController extends Controller
{

    /**
     * Get sales report.
     */
    public function sales(Request $request, ReportService $reportService)
    {
        return response()->json($reportService->getSalesReport($request));
    }

    /**
     * Get top products.
     */
    public function topProducts(Request $request, ReportService $reportService)
    {
        $result = $reportService->getTopProducts($request);
        $status = isset($result['error']) ? 500 : 200;
        return response()->json($result, $status);
    }

    /**
     * Get category sales.
     */
    public function categorySales(Request $request, ReportService $reportService)
    {
        $result = $reportService->getCategorySales($request);
        $status = isset($result['error']) ? 500 : 200;
        return response()->json($result, $status);
    }

    /**
     * Get yearly category revenue.
     */
    public function yearlyCategoryRevenue(Request $request, ReportService $reportService)
    {
        $result = $reportService->getYearlyCategoryRevenue($request);
        $status = isset($result['error']) ? 500 : 200;
        return response()->json($result, $status);
    }

    /**
     * Get return rate by category.
     */
    public function returnRateByCategory(Request $request, ReportService $reportService)
    {
        $result = $reportService->getReturnRateByCategory($request);
        $status = isset($result['error']) ? 500 : 200;
        return response()->json($result, $status);
    }

    /**
     * Get inventory report.
     */
    public function inventory(Request $request, ReportService $reportService)
    {
        return response()->json($reportService->getInventoryReport($request));
    }

    /**
     * Export report to PDF.
     */
    public function export(Request $request, ReportExportService $exportService)
    {
        $result = $exportService->exportPDF(
            [
                'from' => $request->input('from'),
                'to' => $request->input('to'),
            ],
            $request->input('type', 'sales')
        );

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->stream(
            function () use ($result) {
                echo $result['pdf'];
            },
            200,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"{$result['filename']}\"",
            ]
        );
    }

    /**
     * Get rating analytics.
     */
    public function ratingAnalytics(Request $request, ReportService $reportService)
    {
        return response()->json($reportService->getRatingAnalytics($request));
    }

    /**
     * Get rating analytics rankings.
     */
    public function ratingAnalyticsRankings(Request $request, ReportService $reportService)
    {
        return response()->json($reportService->getRatingAnalyticsRankings($request));
    }

    /**
     * Get rating analytics feedback.
     */
    public function ratingAnalyticsFeedback(Request $request, ReportService $reportService)
    {
        return response()->json($reportService->getRatingAnalyticsFeedback($request));
    }

    /**
     * Get customer behavior analytics.
     */
    public function customerBehavior(Request $request, ReportService $reportService)
    {
        return response()->json($reportService->getCustomerBehavior($request));
    }

    /**
     * Get inventory forecast.
     */
    public function inventoryForecast(Request $request, ReportService $reportService)
    {
        return response()->json($reportService->getInventoryForecast($request));
    }

    /**
     * Get profit margins.
     */
    public function profitMargins(Request $request, ReportService $reportService)
    {
        return response()->json($reportService->getProfitMargins($request));
    }

    /**
     * Get recent activity.
     */
    public function recentActivity(Request $request, ReportService $reportService)
    {
        $result = $reportService->getRecentActivity();
        $status = isset($result['error']) ? 500 : 200;
        return response()->json($result, $status);
    }
}
