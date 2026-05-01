<?php

namespace App\Services\GCash;

use App\Models\Sale;
use App\Models\User;
use App\Models\GCashTransaction;
use App\Models\Delivery;
use App\Models\CustomerNotification;
use App\Events\DataMutated;
use App\Jobs\SendGcashConfirmationSms;
use App\Notifications\GCashPaymentReceived;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GCashPaymentService
{
    /**
     * Process SMS webhook for GCash payment.
     */
    public function processSmsWebhook($smsBody, $rawPayload)
    {
        $matches = [];
        if (!preg_match('/(?:PHP|Php|P|₱)\s*([0-9,]+\.[0-9]{2})/i', $smsBody, $matches) &&
            !preg_match('/received\s*([0-9,]+\.[0-9]{2})/i', $smsBody, $matches)) {
            Log::info('Could not parse amount from SMS', ['sms' => $smsBody]);

            GCashTransaction::create([
                'sms_body' => $smsBody,
                'raw_payload' => json_encode($rawPayload),
                'matched' => false
            ]);

            return [
                'data' => ['status' => 'ignored', 'reason' => 'no_amount_parsed'],
                'status_code' => 200,
            ];
        }

        $amountStr = str_replace(',', '', $matches[1]);
        $amount = (float) $amountStr;

        $parsedPhone = null;
        $phoneMatches = [];
        if (preg_match('/(09\d{9})/', $smsBody, $phoneMatches)) {
            $parsedPhone = $phoneMatches[1];
        } elseif (preg_match('/(\+639\d{9})/', $smsBody, $phoneMatches)) {
            $parsedPhone = '0' . substr($phoneMatches[1], 3);
        }

        $parsedRef = null;
        $refMatches = [];
        if (preg_match('/(?:Ref\.?\s*(?:No\.?|Number)?:?\s*)(\d{10,20})/i', $smsBody, $refMatches)) {
            $parsedRef = $refMatches[1];
        }

        Log::info("Parsed GCash phone: {$parsedPhone}, amount: {$amount}");

        $amountFormatted = number_format($amount, 2, '.', '');
        $saleIdForSms = null;

        $transactionResult = DB::transaction(function () use (
            $parsedPhone,
            $amountFormatted,
            $smsBody,
            $amount,
            $parsedRef,
            $rawPayload,
            &$saleIdForSms
        ) {
            if (!$parsedPhone) {
                GCashTransaction::create([
                    'sms_body' => $smsBody,
                    'parsed_amount' => $amount,
                    'parsed_ref' => $parsedRef,
                    'raw_payload' => json_encode($rawPayload),
                    'matched' => false,
                ]);

                return ['status' => 'ignored', 'reason' => 'no_sender_phone'];
            }

            $phoneVariants = [
                $parsedPhone,
            ];
            
            // Add robust variants
            if (str_starts_with($parsedPhone, '0')) {
                $phoneVariants[] = '+63' . substr($parsedPhone, 1);
                $phoneVariants[] = '63' . substr($parsedPhone, 1);
            } elseif (str_starts_with($parsedPhone, '+63')) {
                $phoneVariants[] = '0' . substr($parsedPhone, 3);
                $phoneVariants[] = '63' . substr($parsedPhone, 3);
            } elseif (str_starts_with($parsedPhone, '63')) {
                $phoneVariants[] = '0' . substr($parsedPhone, 2);
                $phoneVariants[] = '+63' . substr($parsedPhone, 2);
            }

            // Filter out any invalid strings generated
            $phoneVariants = array_unique(array_filter($phoneVariants, function ($val) {
                return strlen($val) >= 10;
            }));

            $matchingSale = Sale::where('status', 'pending_payment')
                ->where('payment_method', 'gcash')
                ->where('total_amount', $amountFormatted)
                ->where(function ($q) use ($phoneVariants) {
                    $q->whereIn('payment_phone_number', $phoneVariants);
                })
                ->orderBy('created_at', 'desc') // Change from 'asc' to 'desc' to prioritize the newest order
                ->lockForUpdate()
                ->first();

            if (!$matchingSale) {
                Log::warning("No pending order found for phone: {$parsedPhone}, amount: {$amountFormatted}");

                GCashTransaction::create([
                    'sms_body' => $smsBody,
                    'parsed_amount' => $amount,
                    'parsed_ref' => $parsedRef,
                    'raw_payload' => json_encode($rawPayload),
                    'matched' => false,
                ]);

                return ['status' => 'ignored', 'reason' => 'no_matching_order'];
            }

            if ($matchingSale->status !== 'pending_payment') {
                return ['status' => 'ignored', 'reason' => 'already_processed', 'sale_id' => $matchingSale->id];
            }

            $matchingSale->forceFill([
                'status' => 'confirmed',
                'payment_confirmed_at' => now(),
            ])->save();
            $matchingSale->markConfirmedOnce();

            \App\Support\ProductCache::bust();

            GCashTransaction::create([
                'sale_id' => $matchingSale->id,
                'sms_body' => $smsBody,
                'parsed_amount' => $amount,
                'parsed_ref' => $parsedRef,
                'matched' => true,
                'auto_confirmed' => true,
                'raw_payload' => json_encode($rawPayload),
            ]);

            $delivery = $matchingSale->delivery;
            if ($delivery) {
                if (in_array($delivery->status, ['created', 'waiting'])) {
                    $delivery->forceFill(['status' => 'pending'])->save();
                }
            } else {
                $riderFee = (float) \App\Models\Setting::get('rider_default_delivery_fee', 30);
                $delivery = Delivery::create([
                    'sale_id' => $matchingSale->id,
                    'status' => 'pending',
                    'delivery_fee' => $riderFee,
                    'cash_collected' => 0.00,
                    'payout_status' => 'pending',
                ]);
            }

            $matchingSale->loadMissing(['items.product', 'customer']);

            $notificationItems = $matchingSale->items->map(function ($it) {
                return [
                    'name' => optional($it->product)->name ?? 'Item',
                    'quantity' => (int) $it->quantity,
                ];
            })->values()->all();

            CustomerNotification::create([
                'customer_id' => $matchingSale->customer_id,
                'delivery_id' => $delivery ? $delivery->id : null,
                'title' => 'Payment Confirmed',
                'message' => "Your GCash payment of ₱" . number_format($amount, 2) . " for order #{$matchingSale->order_number} has been received and confirmed.",
                'type' => 'payment_confirmed',
                'is_read' => false,
                'meta' => [
                    'amount' => (float) $amount,
                    'order_number' => $matchingSale->order_number,
                    'customer_name' => optional($matchingSale->customer)->name,
                    'phone' => $parsedPhone,
                    'items' => $notificationItems,
                ],
            ]);

            $admins = User::whereIn('id', \Illuminate\Support\Facades\Cache::remember('admin_user_ids', 300, fn () => \App\Models\User::where('role', 'admin')->pluck('id')->all()))->get();
            foreach ($admins as $admin) {
                $admin->notify(new GCashPaymentReceived($matchingSale, $smsBody, $amount, $parsedPhone));
            }

            broadcast(new DataMutated(
                "private-customer.{$matchingSale->customer_id}",
                ['customer_orders', 'customer_notifications'],
                'payment.confirmed'
            ));
            broadcast(new DataMutated(
                'private-admin',
                ['admin_orders', 'admin_dashboard'],
                'payment.confirmed'
            ));

            $saleIdForSms = $matchingSale->id;

            Log::info("Successfully auto-confirmed order #{$matchingSale->order_number} for ₱{$amountFormatted}");

            return ['status' => 'success', 'sale_id' => $matchingSale->id];
        });

        if (!empty($saleIdForSms) && ($transactionResult['status'] ?? null) === 'success') {
            $saleForSms = Sale::find($saleIdForSms);
            if ($saleForSms) {
                dispatch(new SendGcashConfirmationSms($saleForSms, $amount))->afterCommit();
            }
        }

        return [
            'data' => $transactionResult,
            'status_code' => 200,
        ];
    }

    /**
     * Check if order has been confirmed.
     */
    public function checkStatus($customerId, $saleId)
    {
        $sale = Sale::where('customer_id', $customerId)
            ->findOrFail($saleId);

        return [
            'data' => [
                'id' => $sale->id,
                'status' => $sale->status,
                'payment_confirmed_at' => $sale->payment_confirmed_at,
                'is_confirmed' => in_array($sale->status, ['confirmed', 'out_for_delivery', 'delivered'])
            ],
            'status_code' => 200,
        ];
    }
}
