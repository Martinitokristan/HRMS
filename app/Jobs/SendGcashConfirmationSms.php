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

    public int $tries = 3;

    protected Sale $sale;
    protected float $amount;

    public function __construct(Sale $sale, float $amount)
    {
        $this->sale = $sale;
        $this->amount = $amount;
    }

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        $smsEnabled = Setting::get('sms_enabled', '0');
        $gcashSmsEnabled = Setting::get('gcash_confirmed_sms', '0');

        if ($smsEnabled !== '1' || $gcashSmsEnabled !== '1') {
            return;
        }

        $this->sale->loadMissing(['customer', 'items.product']);

        $customer = $this->sale->customer;
        $customerPhone = $this->sale->payment_phone_number ?? optional($customer)->phone;
        if (!$customerPhone) {
            return;
        }

        $customerName = optional($customer)->name ?? 'Valued Customer';
        $itemSummary = $this->sale->items->count() > 0
            ? $this->sale->items->map(function ($i) {
                $name = $i->product->name ?? 'Item';
                $variant = collect([
                    optional(optional($i->productVariant)->sizeValue)->label,
                    optional(optional($i->productVariant)->colorValue)->label,
                    optional(optional($i->productVariant)->weightValue)->label,
                ])->filter()->implode(' / ');
                $variantSuffix = $variant ? ' (' . $variant . ')' : '';
                return $i->quantity . 'x ' . $name . $variantSuffix;
            })->join(', ')
            : "order #{$this->sale->order_number}";

        $message = BrevoSmsService::gcashConfirmedMessage($customerName, $this->amount, $itemSummary);
        BrevoSmsService::send($customerPhone, $message);
    }

    public function failed(\Throwable $e): void
    {
        Log::warning('GCash confirmed SMS final failure: ' . $e->getMessage(), [
            'sale_id' => $this->sale->id ?? null,
        ]);
    }
}
