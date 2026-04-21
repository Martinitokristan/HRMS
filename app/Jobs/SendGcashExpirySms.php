<?php

namespace App\Jobs;

use App\Models\Sale;
use App\Models\Setting;
use App\Services\BrevoSmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SendGcashExpirySms implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    protected Sale $sale;

    public function __construct(Sale $sale)
    {
        $this->sale = $sale;
    }

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        // Re-check toggles at execution time.
        if (Setting::get('sms_enabled', '0') !== '1') {
            return;
        }
        if (Setting::get('gcash_expiry_sms', '0') !== '1') {
            return;
        }

        $sale = Sale::with('customer')->find($this->sale->id);
        if (!$sale) {
            return;
        }

        // Customer may have paid/been confirmed between dispatch and execution.
        if ($sale->status !== 'pending_payment') {
            Log::info('GCash expiry SMS: sale no longer pending_payment, skipping', ['sale_id' => $sale->id, 'status' => $sale->status]);
            return;
        }

        $customer = $sale->customer;
        $customerName = optional($customer)->name ?? 'Valued Customer';

        // Prefer registered account phone, fallback to payment phone.
        $customerPhone = optional($customer)->phone ?? $sale->payment_phone_number ?? null;
        if (!$customerPhone) {
            Log::warning('GCash expiry SMS: no phone available', ['sale_id' => $sale->id, 'order_number' => $sale->order_number]);
            return;
        }

        $appUrl = rtrim(config('app.url'), '/');
        // Some SMS gateways flag non-HTTPS links as suspicious; prefer HTTPS in SMS payloads.
        if (is_string($appUrl) && str_starts_with($appUrl, 'http://')) {
            $appUrl = 'https://' . substr($appUrl, strlen('http://'));
        }
        $token = Str::random(48);
        $proofUrl = "{$appUrl}/submit-proof/{$token}";
        $amount = number_format((float) $sale->total_amount, 2);

        $message = "Hi {$customerName}! Your GCash payment of P{$amount} for your order has not been received in our system.\n\n"
            . "If you already sent the payment, please submit your proof here:\n{$proofUrl}\n\n"
            . "Your order will be confirmed once our admin verifies it.\n- HRMS";

        if (app()->environment('local')) {
            Log::info('GCash expiry SMS (local) simulated', [
                'sale_id' => $sale->id,
                'to' => $customerPhone,
            ]);
            $sent = true;
        } else {
            $sent = BrevoSmsService::send($customerPhone, $message);
        }
        if (!$sent) {
            // Throw so the queue worker retries. We purposely do NOT stamp sent_at/token yet.
            throw new \RuntimeException("GCash expiry SMS send failed for sale_id={$sale->id}");
        }

        // Stamp only after SMS succeeds (prevents premature suppression + allows retries).
        $sale->update([
            'payment_expiry_sms_sent_at' => now(),
            'payment_proof_token' => $token,
        ]);

        Log::info('GCash expiry SMS sent', ['sale_id' => $sale->id, 'to' => $customerPhone]);
    }

    public function failed(\Throwable $e): void
    {
        Log::warning('GCash expiry SMS final failure: ' . $e->getMessage(), [
            'sale_id' => $this->sale->id ?? null,
        ]);
    }
}

