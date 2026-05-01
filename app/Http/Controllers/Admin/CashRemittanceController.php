<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use Illuminate\Http\Request;

class CashRemittanceController extends Controller
{
    /**
     * GET /admin/cash-remittance?date=YYYY-MM-DD
     * Returns one row per rider per day with expected vs remitted cash.
     * Converts Manila timezone date to UTC range for proper business-day querying.
     */
    public function index(Request $request)
    {
        $dateStr = $request->input('date', now('Asia/Manila')->toDateString());
        
        // Parse Manila date and convert to UTC range for querying
        $manilaDate = \Carbon\Carbon::createFromFormat('Y-m-d', $dateStr, 'Asia/Manila');
        $utcStart = $manilaDate->copy()->startOfDay()->setTimezone('UTC');
        $utcEnd = $manilaDate->copy()->endOfDay()->setTimezone('UTC');

        $rows = Delivery::with(['rider', 'sale'])
            ->where('status', 'delivered')
            ->whereBetween('delivered_at', [$utcStart, $utcEnd])
            ->whereHas('sale', function ($q) { $q->where('payment_method', 'cod'); })
            ->get()
            ->groupBy('rider_id')
            ->map(function ($group, $riderId) use ($dateStr) {
                $expected = $group->sum('cash_collected');
                $remitted = $group->whereNotNull('cash_remitted_at')->sum('cash_collected');
                return [
                    'rider_id'    => $riderId,
                    'rider_name'  => optional($group->first()->rider)->name,
                    'date'        => $dateStr,
                    'expected'    => (float) $expected,
                    'remitted'    => (float) $remitted,
                    'outstanding' => (float) ($expected - $remitted),
                    'count'       => $group->count(),
                    'pending_ids' => $group->whereNull('cash_remitted_at')->pluck('id')->values(),
                ];
            })
            ->values();

        return response()->json(['data' => $rows, 'status' => 'success']);
    }

    /**
     * POST /admin/cash-remittance/{rider}/{date}/mark-remitted
     * Marks deliveries as remitted using Manila timezone date range.
     */
    public function markRemitted(Request $request, $rider, $date)
    {
        $now = now();
        $adminId = $request->user()->id;

        // Parse Manila date and convert to UTC range for querying
        $manilaDate = \Carbon\Carbon::createFromFormat('Y-m-d', $date, 'Asia/Manila');
        $utcStart = $manilaDate->copy()->startOfDay()->setTimezone('UTC');
        $utcEnd = $manilaDate->copy()->endOfDay()->setTimezone('UTC');

        $deliveries = Delivery::with('sale')
            ->where('rider_id', $rider)
            ->whereBetween('delivered_at', [$utcStart, $utcEnd])
            ->whereHas('sale', function ($q) { $q->where('payment_method', 'cod'); })
            ->whereNull('cash_remitted_at')
            ->get();

        $promoter = app(\App\Services\Deliveries\DeliveryPayoutEligibilityService::class);
        foreach ($deliveries as $d) {
            $d->update(['cash_remitted_at' => $now, 'cash_remitted_by' => $adminId]);
            $promoter->maybePromoteToEligible($d->fresh());
        }

        return response()->json([
            'status' => 'success',
            'count'  => $deliveries->count(),
        ]);
    }
}
