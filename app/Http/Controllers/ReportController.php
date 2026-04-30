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
        $data = $reportService->getSalesReport($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get top products.
     */
    public function topProducts(Request $request, ReportService $reportService)
    {
        $data = $reportService->getTopProducts($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get category sales.
     */
    public function categorySales(Request $request, ReportService $reportService)
    {
        $data = $reportService->getCategorySales($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get yearly category revenue.
     */
    public function yearlyCategoryRevenue(Request $request, ReportService $reportService)
    {
        $data = $reportService->getYearlyCategoryRevenue($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get return rate by category.
     */
    public function returnRateByCategory(Request $request, ReportService $reportService)
    {
        $data = $reportService->getReturnRateByCategory($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get inventory report.
     */
    public function inventory(Request $request, ReportService $reportService)
    {
        $data = $reportService->getInventoryReport($request);

        return response()->json(['data' => $data, 'status' => 'success']);
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
        $data = $reportService->getRatingAnalytics($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get rating analytics rankings.
     */
    public function ratingAnalyticsRankings(Request $request, ReportService $reportService)
    {
        $data = $reportService->getRatingAnalyticsRankings($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get rating analytics feedback.
     */
    public function ratingAnalyticsFeedback(Request $request, ReportService $reportService)
    {
        $data = $reportService->getRatingAnalyticsFeedback($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get customer behavior analytics.
     */
    public function customerBehavior(Request $request, ReportService $reportService)
    {
        $data = $reportService->getCustomerBehavior($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get inventory forecast.
     */
    public function inventoryForecast(Request $request, ReportService $reportService)
    {
        $data = $reportService->getInventoryForecast($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get profit margins.
     */
    public function profitMargins(Request $request, ReportService $reportService)
    {
        $data = $reportService->getProfitMargins($request);

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    /**
     * Get recent activity.
     */
    public function recentActivity(Request $request, ReportService $reportService)
    {
        $data = $reportService->getRecentActivity();

        return response()->json(['data' => $data, 'status' => 'success']);
    }
}
