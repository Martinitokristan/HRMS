<?php

namespace App\Console\Commands;

use App\Services\Deliveries\DeliveryPayoutEligibilityService;
use App\Models\Delivery;
use App\Models\Setting;
use Illuminate\Console\Command;

class SweepPayouts extends Command
{
    protected $signature = 'payouts:sweep';
    protected $description = 'Auto-confirm delivered rows after the customer-confirmation window and promote eligible deliveries.';

    public function handle()
    {
        $hours = (int) Setting::get('rider_customer_confirm_window_hours', 24);
        $cutoff = now()->subHours($hours);

        $promoter = app(DeliveryPayoutEligibilityService::class);

        // 1. Auto-confirm rows past the customer window with no response.
        Delivery::where('status', 'delivered')
            ->whereNotNull('delivered_at')
            ->whereNull('customer_confirmed_at')
            ->whereNull('customer_disputed_at')
            ->where('delivered_at', '<', $cutoff)
            ->chunkById(200, function ($chunk) use ($promoter) {
                foreach ($chunk as $d) {
                    $d->update(['customer_confirmed_at' => now()]);
                    $promoter->maybePromoteToEligible($d->fresh());
                }
            });

        // 2. Promote stragglers (e.g. proof uploaded after cash remitted).
        Delivery::where('payout_status', 'pending')
            ->where('status', 'delivered')
            ->whereNotNull('proof_photo')
            ->chunkById(200, function ($chunk) use ($promoter) {
                foreach ($chunk as $d) {
                    $promoter->maybePromoteToEligible($d->fresh());
                }
            });

        return 0;
    }
}
