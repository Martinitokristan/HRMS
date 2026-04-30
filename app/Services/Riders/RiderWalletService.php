<?php

namespace App\Services\Riders;

use App\Models\Delivery;

class RiderWalletService
{
    /**
     * Get rider wallet and earnings information.
     */
    public function getWallet($riderId)
    {
        $today = now()->startOfDay();

        $todayEarnings = (float) Delivery::where('rider_id', $riderId)
            ->where('status', 'delivered')
            ->where('created_at', '>=', $today)
            ->whereIn('payout_status', ['eligible', 'paid'])
            ->sum('delivery_fee');

        $available = (float) Delivery::where('rider_id', $riderId)
            ->where('payout_status', 'eligible')
            ->sum('delivery_fee');

        $pending = (float) Delivery::where('rider_id', $riderId)
            ->whereIn('payout_status', ['pending', 'held'])
            ->sum('delivery_fee');

        $cashToRemitToday = (float) Delivery::where('rider_id', $riderId)
            ->where('status', 'delivered')
            ->whereDate('delivered_at', now()->toDateString())
            ->whereHas('sale', function ($q) {
                $q->where('payment_method', 'cod');
            })
            ->whereNull('cash_remitted_at')
            ->sum('cash_collected');

        $recentPaid = Delivery::where('rider_id', $riderId)
            ->where('payout_status', 'paid')
            ->orderByDesc('paid_at')
            ->limit(10)
            ->get(['id', 'tracking_number', 'delivery_fee', 'paid_at']);

        return [
            'data' => [
                'today_earnings' => $todayEarnings,
                'available' => $available,
                'pending' => $pending,
                'cash_to_remit_today' => $cashToRemitToday,
                'recent_paid' => $recentPaid,
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Get paginated delivery history with optional date filtering.
     */
    public function getHistory($riderId, $page = 1, $perPage = 20, $from = null, $to = null)
    {
        $perPage = min(50, max(5, $perPage));

        $validDate = function ($d) {
            if (!is_string($d) || $d === '') {
                return false;
            }
            $parsed = \DateTime::createFromFormat('Y-m-d', $d);
            return $parsed && $parsed->format('Y-m-d') === $d;
        };

        $from = $validDate($from) ? $from : null;
        $to = $validDate($to) ? $to : null;

        $query = Delivery::where('rider_id', $riderId)
            ->whereIn('status', ['delivered', 'failed'])
            ->with([
                'sale:id,total_amount,payment_method,customer_id',
                'sale.customer:id,name',
                'sale.items.product:id,name',
            ])
            ->orderByDesc('delivered_at')
            ->orderByDesc('id');

        if ($from) {
            $query->where('delivered_at', '>=', $from . ' 00:00:00');
        }
        if ($to) {
            $query->where('delivered_at', '<=', $to . ' 23:59:59');
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items())->map(function ($d) {
            return [
                'id' => $d->id,
                'order_id' => $d->sale_id,
                'customer_name' => optional(optional($d->sale)->customer)->name,
                'address' => $d->address,
                'amount' => (float) (optional($d->sale)->total_amount ?? 0),
                'payment_method' => optional($d->sale)->payment_method,
                'status' => $d->status,
                'delivered_at' => $d->delivered_at,
                'proof_photo_url' => $d->proof_photo ? asset('storage/' . $d->proof_photo) : null,
                'delivery_fee' => (float) ($d->delivery_fee ?? 0),
                'payout_status' => $d->payout_status,
                'geofence_flagged' => (bool) ($d->geofence_flagged ?? false),
                'item_count' => optional(optional($d->sale)->items)->count() ?? 0,
            ];
        });

        return [
            'data' => $rows,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'status_code' => 200,
        ];
    }
}
