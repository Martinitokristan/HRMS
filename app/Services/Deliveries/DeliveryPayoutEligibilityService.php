<?php

namespace App\Services\Deliveries;

use App\Models\Delivery;
use App\Models\Setting;

class DeliveryPayoutEligibilityService
{
    /**
     * Promote a delivery from `pending` to `eligible` when all gating checks pass.
     * This is called by updateStatus, uploadProof, and customerConfirmReceipt.
     */
    public function maybePromoteToEligible(Delivery $d)
    {
        if (!$d) {
            return;
        }
        if ($d->payout_status === 'paid') {
            return;
        }
        if ($d->status !== 'delivered') {
            return;
        }
        if (empty($d->proof_photo)) {
            return;
        }
        if ($d->customer_disputed_at) {
            $d->update(['payout_status' => 'held']);
            return;
        }
        if ($d->geofence_flagged) {
            $d->update(['payout_status' => 'held']);
            return;
        }

        $windowHours = (int) Setting::get('rider_customer_confirm_window_hours', 24);
        $customerOk = $d->customer_confirmed_at
            || ($d->delivered_at && $d->delivered_at->lt(now()->subHours($windowHours)));
        if (!$customerOk) {
            return;
        }

        $sale = $d->sale ?: optional($d->fresh(['sale']))->sale;
        $codOk = $sale && (strtolower((string) $sale->payment_method) !== 'cod' || $d->cash_remitted_at);
        if (!$codOk) {
            return;
        }

        $d->update([
            'payout_status' => 'eligible',
            'payout_eligible_at' => now(),
        ]);
    }
}
