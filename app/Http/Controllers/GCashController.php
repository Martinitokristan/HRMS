<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Sale;
use App\Models\User;
use App\Models\GCashTransaction;
use App\Models\Delivery;
use App\Models\CustomerNotification;
use App\Events\DataMutated;
use App\Jobs\SendGcashConfirmationSms;
use App\Notifications\GCashPaymentReceived;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class GCashController extends Controller
{
    /**
     * Webhook endpoint to receive SMS forwarded from Android
     */
    public function smsWebhook(Request $request)
    {
        // 1. Verify Secret Header
        $secret = env('GCASH_SMS_SECRET');
        $providedSecret = $request->header('X-SMS-Secret');
        
        if (empty($secret) || !is_string($providedSecret) || !hash_equals((string) $secret, $providedSecret)) {
            Log::warning('Unauthorized SMS Webhook attempt', ['ip' => $request->ip()]);
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // Get the SMS body (depends on which app is used, usually in a dynamic field. Let's assume standard 'message', 'body', or raw text)
        // Usually SMS Forwarder apps send JSON like: { "from": "GCash", "content": "You have received..." }
        $smsBody = $request->input('content') ?? $request->input('message') ?? $request->input('body') ?? '';

        if (empty($smsBody)) {
            // Some forwarders just send the raw string in the body
            $smsBody = $request->getContent();
        }

        Log::info('Received GCash SMS:', ['body' => $smsBody]);

        // 2. Parse the amount from the SMS body
        // GCash SMS format: "You have received PHP 540.02 of GCash from..." 
        // Or "You have received P540.02 of GCash..."
        // Or "You have received Php 540.02..."
        // Regex to extract the number:
        $matches = [];
        // Match numbers following PHP, P, Php, or ₱ with optional space
        if (!preg_match('/(?:PHP|Php|P|₱)\s*([0-9,]+\.[0-9]{2})/i', $smsBody, $matches) && 
            !preg_match('/received\s*([0-9,]+\.[0-9]{2})/i', $smsBody, $matches)) {
            Log::info('Could not parse amount from SMS', ['sms' => $smsBody]);
            
            // Still log it in DB but unmatched
            GCashTransaction::create([
                'sms_body' => $smsBody,
                'raw_payload' => json_encode($request->all()),
                'matched' => false
            ]);
            
            return response()->json(['status' => 'ignored', 'reason' => 'no_amount_parsed']);
        }

        $amountStr = str_replace(',', '', $matches[1]);
        $amount = (float) $amountStr;

        Log::info("Parsed GCash amount: {$amount}");

        // 3. Parse sender phone number from notification
        // Format: "You have received PHP 1.16 of GCash from K** RI**Y S. 09070574360."
        $parsedPhone = null;
        $phoneMatches = [];
        if (preg_match('/(09\d{9})/', $smsBody, $phoneMatches)) {
            $parsedPhone = $phoneMatches[1];
        } elseif (preg_match('/(\+639\d{9})/', $smsBody, $phoneMatches)) {
            $parsedPhone = '0' . substr($phoneMatches[1], 3); // Convert +639 → 09
        }

        // Optionally parse reference number (if GCash includes it in future)
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
            $request,
            &$saleIdForSms
        ) {
            if (!$parsedPhone) {
                GCashTransaction::create([
                    'sms_body' => $smsBody,
                    'parsed_amount' => $amount,
                    'parsed_ref' => $parsedRef,
                    'raw_payload' => json_encode($request->all()),
                    'matched' => false,
                ]);

                return ['status' => 'ignored', 'reason' => 'no_sender_phone'];
            }

            // Normalize: try 09XX, +639XX, and 639XX formats so both pre- and post-
            // 2026-04-25 normalization rows match.
            $phoneVariants = [
                $parsedPhone, // 09070574360
                '+63' . substr($parsedPhone, 1), // +639070574360
                '63' . substr($parsedPhone, 1),  // 639070574360 (legacy, no plus)
                str_replace('+63', '0', $parsedPhone), // safety fallback
            ];

            $matchingSale = Sale::where('status', 'pending_payment')
                ->where('payment_method', 'gcash')
                ->where('total_amount', $amountFormatted)
                ->where(function ($q) use ($phoneVariants) {
                    $q->whereIn('payment_phone_number', $phoneVariants);
                })
                ->orderBy('created_at', 'asc')
                ->lockForUpdate()
                ->first();

            if (!$matchingSale) {
                Log::warning("No pending order found for phone: {$parsedPhone}, amount: {$amountFormatted}");

                GCashTransaction::create([
                    'sms_body' => $smsBody,
                    'parsed_amount' => $amount,
                    'parsed_ref' => $parsedRef,
                    'raw_payload' => json_encode($request->all()),
                    'matched' => false,
                ]);

                return ['status' => 'ignored', 'reason' => 'no_matching_order'];
            }

            // Re-check state under lock for idempotency.
            if ($matchingSale->status !== 'pending_payment') {
                return ['status' => 'ignored', 'reason' => 'already_processed', 'sale_id' => $matchingSale->id];
            }

            $matchingSale->forceFill([
                'status' => 'confirmed',
                'payment_confirmed_at' => now(),
            ])->save();

            try {
                Cache::tags(['products'])->flush();
            } catch (\BadMethodCallException $e) {
                Cache::flush();
            }

            // Create GCash Transaction Log
            GCashTransaction::create([
                'sale_id' => $matchingSale->id,
                'sms_body' => $smsBody,
                'parsed_amount' => $amount,
                'parsed_ref' => $parsedRef,
                'matched' => true,
                'auto_confirmed' => true,
                'raw_payload' => json_encode($request->all()),
            ]);

            // Update delivery status from created/waiting to pending, if it exists
            $delivery = $matchingSale->delivery;
            if ($delivery) {
                if (in_array($delivery->status, ['created', 'waiting'])) {
                    $delivery->forceFill(['status' => 'pending'])->save();
                }
            } else {
                $delivery = Delivery::create([
                    'sale_id' => $matchingSale->id,
                    'status' => 'pending',
                ]);
            }

            // Send notification to customer
            $matchingSale->loadMissing(['items.product', 'customer']);

            $notificationItems = $matchingSale->items->map(function ($it) {
                return [
                    'name' => optional($it->product)->name ?? 'Item',
                    'quantity' => (float) $it->quantity,
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
                    'amount'        => (float) $amount,
                    'order_number'  => $matchingSale->order_number,
                    'customer_name' => optional($matchingSale->customer)->name,
                    'phone'         => $parsedPhone,
                    'items'         => $notificationItems,
                ],
            ]);

            // Send notification to admin users about GCash payment
            $admins = User::whereIn('id', \Illuminate\Support\Facades\Cache::remember('admin_user_ids', 300, fn () => \App\Models\User::where('role', 'admin')->pluck('id')->all()))->get();
            foreach ($admins as $admin) {
                $admin->notify(new GCashPaymentReceived($matchingSale, $smsBody, $amount, $parsedPhone));
            }

            // Broadcast real-time update so customer's order list and notifications refresh instantly
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

        return response()->json($transactionResult);
    }

    /**
     * Public: Get order details by proof token (no auth required)
     */
    public function getProofOrder(Request $request, string $token)
    {
        $sale = Sale::where('payment_proof_token', $token)
            ->whereIn('status', ['pending_payment', 'verifying_payment'])
            ->with(['customer', 'items.product'])
            ->first();

        if (!$sale) {
            return response()->json(['error' => 'Invalid or expired link.'], 404);
        }

        if ($sale->payment_proof_token_used_at !== null) {
            return response()->json([
                'message' => 'This proof link has already been used.',
                'status'  => 'error',
            ], 410);
        }

        return response()->json([
            'order_number'  => $sale->order_number,
            'total_amount'  => $sale->total_amount,
            'status'        => $sale->status,
            'customer_name' => optional($sale->customer)->name ?? 'Customer',
            'items'         => $sale->items->map(fn($i) => [
                'name'     => $i->product->name ?? 'Item',
                'quantity' => $i->quantity,
            ]),
            'already_submitted' => !is_null($sale->payment_proof_path),
        ]);
    }

    /**
     * Public: Submit GCash payment proof via token link (no auth required)
     */
    public function submitProof(Request $request, string $token)
    {
        $request->validate([
            'payment_reference' => 'required|string|max:50',
            'payment_proof'     => 'required|image|mimes:jpeg,jpg,png,webp|max:5120|dimensions:max_width=4000,max_height=4000',
        ]);

        $storedPath = null;
        try {
            $matched = true;

            DB::transaction(function () use ($token, $request, &$storedPath, &$matched) {
                $sale = Sale::where('payment_proof_token', $token)
                    ->where('status', 'pending_payment')
                    ->lockForUpdate()
                    ->first();

                if (!$sale) {
                    $matched = false;
                    return;
                }

                if ($sale->payment_proof_token_used_at !== null) {
                    $matched = false;
                    return;
                }

                // Only store the file after we confirm the row is still claimable under lock.
                $storedPath = $request->file('payment_proof')->store('payment_proofs', 'public');

                $sale->update([
                    'payment_reference' => $request->payment_reference,
                    'payment_proof_path' => $storedPath,
                    'status' => 'verifying_payment',
                    'payment_proof_token_used_at' => now(),
                ]);
            });

            if (!$matched) {
                return response()->json(['error' => 'Invalid link or proof already submitted.'], 404);
            }
        } catch (\Throwable $e) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $e;
        }

        // Notify admin in real-time
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'payment.proof_submitted'));

        Log::info("Proof submitted via token link.", ['token' => $token]);

        return response()->json([
            'message' => 'Proof submitted successfully. Our admin will verify your payment shortly.',
            'status'  => 'success',
        ]);
    }

    /**
     * Polling endpoint for frontend to check if order was confirmed
     */
    public function checkStatus(Request $request, $saleId)
    {
        $sale = Sale::where('customer_id', $request->user()->id)
                    ->findOrFail($saleId);

        return response()->json([
            'id' => $sale->id,
            'status' => $sale->status,
            'payment_confirmed_at' => $sale->payment_confirmed_at,
            'is_confirmed' => in_array($sale->status, ['confirmed', 'out_for_delivery', 'delivered'])
        ]);
    }

    /**
     * Admin endpoint to fetch all GCash Transactions
     */
    public function index(Request $request)
    {
        $query = GCashTransaction::with('sale.customer')->orderBy('created_at', 'desc');

        if ($request->has('matched')) {
            $query->where('matched', $request->matched === 'true' || $request->matched === '1');
        }

        $logs = $query->paginate($request->per_page ?? 20);

        return response()->json($logs);
    }
}
