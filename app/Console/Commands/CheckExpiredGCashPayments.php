<?php

namespace App\Console\Commands;

use App\Models\Sale;
use App\Jobs\SendGcashExpirySms;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckExpiredGCashPayments extends Command
{
    protected $signature   = 'gcash:check-expired';
    protected $description = 'Send expiry SMS to customers whose GCash payment has not been received after 15 minutes';

    public function handle(): void
    {
        // Respect the SMS master toggle
        if (\App\Models\Setting::get('sms_enabled', '0') !== '1') {
            return;
        }

        // Allow expiry SMS to be toggled independently of the master SMS switch
        if (\App\Models\Setting::get('gcash_expiry_sms', '0') !== '1') {
            return;
        }

        $expiredOrders = Sale::where('status', 'pending_payment')
            ->where('payment_method', 'gcash')
            ->whereNull('payment_expiry_sms_sent_at')
            ->where('created_at', '<=', now()->subMinutes(15))
            ->with('customer')
            ->get();

        if ($expiredOrders->isEmpty()) {
            return;
        }

        foreach ($expiredOrders as $sale) {
            dispatch(new SendGcashExpirySms($sale));
        }

        Log::info('Dispatched GCash expiry SMS jobs', ['count' => $expiredOrders->count()]);
        $this->info("Dispatched {$expiredOrders->count()} expiry SMS job(s).");
    }
}
