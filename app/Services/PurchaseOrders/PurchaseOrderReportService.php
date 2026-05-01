<?php

namespace App\Services\PurchaseOrders;

use App\Models\PurchaseOrder;
use Carbon\Carbon;
use DB;

class PurchaseOrderReportService
{
    /**
     * Get supplier revenue report.
     */
    public function revenueReport($supplierId, $period = 'year', $year = null, $month = null)
    {
        $year = $year ?: now()->year;
        $month = $month ?: now()->month;

        $query = PurchaseOrder::where('supplier_id', $supplierId)
            ->whereIn('status', ['accepted', 'supplier_delivered', 'received']);

        $isYearlyView = ($period === 'year' || empty($month));

        if ($isYearlyView) {
            $from = now()->setYear($year)->startOfYear();
            $to = now()->setYear($year)->endOfYear();

            $data = $query->whereBetween('created_at', [$from, $to])
                ->select(
                    DB::raw('MONTH(created_at) as label_num'),
                    DB::raw('SUM(total_cost) as value')
                )
                ->groupBy('label_num')
                ->orderBy('label_num')
                ->get()->toArray();

            $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            $formatted = [];
            for ($i = 1; $i <= 12; $i++) {
                $found = $data->firstWhere('label_num', $i);
                $formatted[] = [
                    'label' => $months[$i - 1],
                    'value' => $found ? (float)$found->value : 0
                ];
            }
        } else {
            $from = now()->setYear($year)->setMonth($month)->startOfMonth();
            $to = (clone $from)->endOfMonth();

            $data = $query->whereBetween('created_at', [$from, $to])
                ->select(
                    DB::raw('DAY(created_at) as label_num'),
                    DB::raw('SUM(total_cost) as value')
                )
                ->groupBy('label_num')
                ->orderBy('label_num')
                ->get()->toArray();

            $formatted = [];
            $daysInMonth = $from->daysInMonth;
            for ($i = 1; $i <= $daysInMonth; $i++) {
                $found = $data->firstWhere('label_num', $i);
                $formatted[] = [
                    'label' => (string)$i,
                    'value' => $found ? (float)$found->value : 0
                ];
            }
        }

        return [
            'data' => $formatted,
            'status_code' => 200,
        ];
    }
}
