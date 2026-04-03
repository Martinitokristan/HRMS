<?php

namespace App\Console\Commands;

use App\Models\Sale;
use App\Services\BrevoSmsService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class CheckExpiredGCashPayments extends Command
{
    protected $signature   = 'gcash:check-expired';
    protected $description = 'Send expiry SMS to customers whose GCash payment has not been received after 15 minutes';

    public function handle(): void
    {
        $expiredOrders = Sale::where('status', 'pending_payment')
            ->where('payment_method', 'gcash')
            ->whereNull('payment_expiry_sms_sent_at')
            ->where('created_at', '<=', now()->subMinutes(15))
            ->with('customer')
            ->get();

        if ($expiredOrders->isEmpty()) {
            return;
        }

        $appUrl = rtrim(config('app.url'), '/');

        foreach ($expiredOrders as $sale) {
            try {
                // Generate a unique proof token
                $token = Str::random(48);
                $sale->update([
                    'payment_proof_token'       => $token,
                    'payment_expiry_sms_sent_at'=> now(),
                ]);

                $customer     = $sale->customer;
                $customerName = $customer->name ?? 'Valued Customer';
                $customerPhone = $sale->payment_phone_number ?? $customer->phone ?? null;

                if (!$customerPhone) {
                    Log::warning("GCash expiry: no phone for order #{$sale->order_number}");
                    continue;
                }

                $proofUrl = "{$appUrl}/submit-proof/{$token}";
                $amount   = number_format($sale->total_amount, 2);

                $message = "Hi {$customerName}! Your GCash payment of P{$amount} for your order has not been received in our system.\n\n"
                         . "If you already sent the payment, please submit your proof here:\n{$proofUrl}\n\n"
                         . "Your order will be confirmed once our admin verifies it.\n- HRMS";

                BrevoSmsService::send($customerPhone, $message);
                Log::info("GCash expiry SMS sent for order #{$sale->order_number} to {$customerPhone}");

            } catch (\Exception $e) {
                Log::error("GCash expiry SMS failed for order #{$sale->order_number}: " . $e->getMessage());
            }
        }

        $this->info("Processed {$expiredOrders->count()} expired GCash order(s).");
    }
}
