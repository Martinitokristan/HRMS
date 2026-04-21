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

class SendGcashConfirmationSms implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected Sale $sale;
    protected float $amount;

    public function __construct(Sale $sale, float $amount)
    {
        $this->sale = $sale;
        $this->amount = $amount;
    }

    public function handle(): void
    {
        try {
            $smsEnabled = Setting::get('sms_enabled', '0');
            $gcashSmsEnabled = Setting::get('gcash_confirmed_sms', '0');

            if ($smsEnabled !== '1' || $gcashSmsEnabled !== '1') {
                return;
            }

            $this->sale->loadMissing(['customer', 'items.product']);

            $customer = $this->sale->customer;
            $customerPhone = $this->sale->payment_phone_number ?? ($customer->phone ?? null);
            if (!$customerPhone) {
                return;
            }

            $customerName = $customer->name ?? 'Valued Customer';
            $itemSummary = $this->sale->items->count() > 0
                ? $this->sale->items->map(fn($i) => $i->quantity . 'x ' . ($i->product->name ?? 'Item'))->join(', ')
                : "order #{$this->sale->order_number}";

            $message = BrevoSmsService::gcashConfirmedMessage($customerName, $this->amount, $itemSummary);
            BrevoSmsService::send($customerPhone, $message);
        } catch (\Exception $e) {
            Log::warning('GCash confirmed SMS failed: ' . $e->getMessage());
        }
    }
}
