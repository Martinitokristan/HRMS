<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomerNotification;
use App\Models\Delivery;
use Illuminate\Http\Request;

class RiderPayoutController extends Controller
{
    /**
     * GET /admin/payouts?status=eligible|held|paid
     * Groups eligible/held/paid rows by rider so admin can pay them in batches.
     */
    public function index(Request $request)
    {
        $status = $request->input('status', 'eligible');

        $rows = Delivery::with(['rider', 'sale'])
            ->where('payout_status', $status)
            ->orderBy('payout_eligible_at')
            ->get()
            ->groupBy('rider_id')
            ->map(function ($group, $riderId) {
                return [
                    'rider_id'   => $riderId,
                    'rider_name' => optional($group->first()->rider)->name,
                    'count'      => $group->count(),
                    'total_fee'  => (float) $group->sum('delivery_fee'),
                    'rows'       => $group->map(function ($d) {
                        return [
                            'id'                => $d->id,
                            'tracking_number'   => $d->tracking_number,
                            'delivered_at'      => $d->delivered_at,
                            'delivery_fee'      => (float) $d->delivery_fee,
                            'payment_method'    => optional($d->sale)->payment_method,
                            'geofence_flagged'  => (bool) $d->geofence_flagged,
                            'geofence_distance' => $d->geofence_distance_m,
                            'customer_disputed' => (bool) $d->customer_disputed_at,
                            'customer_dispute_reason' => $d->customer_dispute_reason,
                        ];
                    })->values(),
                ];
            })
            ->values();

        return response()->json(['data' => $rows, 'status' => 'success']);
    }

    /**
     * POST /admin/payouts/mark-paid   { rider_id, delivery_ids: [int] }
     */
    public function markPaid(Request $request)
    {
        $request->validate([
            'rider_id'       => 'required|integer',
            'delivery_ids'   => 'required|array|min:1',
            'delivery_ids.*' => 'integer',
        ]);

        $now = now();
        $adminId = $request->user()->id;

        Delivery::where('rider_id', $request->rider_id)
            ->whereIn('id', $request->delivery_ids)
            ->where('payout_status', 'eligible')
            ->update([
                'payout_status' => 'paid',
                'paid_at'       => $now,
                'paid_by'       => $adminId,
            ]);

        // Notify the rider. customer_notifications.customer_id holds any user id (rider also a user).
        CustomerNotification::create([
            'customer_id' => $request->rider_id,
            'delivery_id' => null,
            'type'        => 'rider_payout_paid',
            'title'       => 'Cash-out paid',
            'message'     => "Your cash-out for {$now->toDateString()} has been paid via GCash.",
            'meta'        => ['delivery_ids' => $request->delivery_ids],
            'is_read'     => false,
        ]);

        return response()->json(['status' => 'success']);
    }

    /**
     * POST /admin/payouts/release-hold   { delivery_id, decision: release|reject, note? }
     */
    public function releaseHold(Request $request)
    {
        $request->validate([
            'delivery_id' => 'required|integer',
            'decision'    => 'required|in:release,reject',
            'note'        => 'nullable|string|max:500',
        ]);

        $d = Delivery::findOrFail($request->delivery_id);
        if ($d->payout_status !== 'held') {
            return response()->json(['message' => 'Not held'], 422);
        }

        if ($request->decision === 'release') {
            $d->update([
                'payout_status'           => 'eligible',
                'payout_eligible_at'      => now(),
                'geofence_flagged'        => false,
                'customer_disputed_at'    => null,
                'customer_dispute_reason' => null,
            ]);
        } else {
            $d->update(['payout_status' => 'rejected']);
        }

        return response()->json(['status' => 'success']);
    }
}
