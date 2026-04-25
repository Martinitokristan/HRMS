<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\DeliveryController;
use App\Models\Delivery;
use Illuminate\Http\Request;

class CashRemittanceController extends Controller
{
    /**
     * GET /admin/cash-remittance?date=YYYY-MM-DD
     * Returns one row per rider per day with expected vs remitted cash.
     */
    public function index(Request $request)
    {
        $date = $request->input('date', now()->toDateString());

        $rows = Delivery::with(['rider', 'sale'])
            ->where('status', 'delivered')
            ->whereDate('delivered_at', $date)
            ->whereHas('sale', function ($q) { $q->where('payment_method', 'cod'); })
            ->get()
            ->groupBy('rider_id')
            ->map(function ($group, $riderId) use ($date) {
                $expected = $group->sum('cash_collected');
                $remitted = $group->whereNotNull('cash_remitted_at')->sum('cash_collected');
                return [
                    'rider_id'    => $riderId,
                    'rider_name'  => optional($group->first()->rider)->name,
                    'date'        => $date,
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
     */
    public function markRemitted(Request $request, $rider, $date)
    {
        $now = now();
        $adminId = $request->user()->id;

        $deliveries = Delivery::with('sale')
            ->where('rider_id', $rider)
            ->whereDate('delivered_at', $date)
            ->whereHas('sale', function ($q) { $q->where('payment_method', 'cod'); })
            ->whereNull('cash_remitted_at')
            ->get();

        $promoter = app(DeliveryController::class);
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
