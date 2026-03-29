<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Sale;
use App\Models\User;
use App\Models\GCashTransaction;
use App\Models\Delivery;
use App\Models\CustomerNotification;
use App\Notifications\GCashPaymentReceived;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GCashController extends Controller
{
    /**
     * Webhook endpoint to receive SMS forwarded from Android
     */
    public function smsWebhook(Request $request)
    {
        // 1. Verify Secret Header or URL Parameter
        $secret = env('GCASH_SMS_SECRET');
        $providedSecret = $request->header('X-SMS-Secret') ?? $request->query('secret');
        
        if (empty($secret) || $providedSecret !== $secret) {
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

        // 4. Find matching pending_payment sale by PHONE + AMOUNT
        $matchingSale = null;

        if ($parsedPhone) {
            // Normalize: try both 09XX and +639XX formats
            $phoneVariants = [
                $parsedPhone,                                    // 09070574360
                '+63' . substr($parsedPhone, 1),                 // +639070574360
                str_replace('+63', '0', $parsedPhone),           // safety fallback
            ];

            $matchingSale = Sale::where('status', 'pending_payment')
                                ->where('payment_method', 'gcash')
                                ->where('total_amount', $amount)
                                ->whereHas('customer', function ($q) use ($phoneVariants) {
                                    $q->whereIn('phone', $phoneVariants);
                                })
                                ->orderBy('created_at', 'asc')
                                ->first();
        }

        // Fallback: amount-only match if phone wasn't parsed
        if (!$matchingSale) {
            $matchingSale = Sale::where('status', 'pending_payment')
                                ->where('payment_method', 'gcash')
                                ->where('total_amount', $amount)
                                ->orderBy('created_at', 'asc')
                                ->first();

            if ($matchingSale && $parsedPhone) {
                Log::info("Phone match failed, fell back to amount-only match for order #{$matchingSale->order_number}");
            }
        }

        if (!$matchingSale) {
            Log::warning("No pending order found for phone: {$parsedPhone}, amount: {$amount}");
            
            GCashTransaction::create([
                'sms_body' => $smsBody,
                'parsed_amount' => $amount,
                'parsed_ref' => $parsedRef,
                'raw_payload' => json_encode($request->all()),
                'matched' => false
            ]);

            return response()->json(['status' => 'ignored', 'reason' => 'no_matching_order']);
        }

        $sale = $matchingSale;

        // 5. Update the order to confirmed inside a transaction
        DB::beginTransaction();
        try {
            $sale->status = 'confirmed';
            $sale->payment_confirmed_at = now();
            $sale->save();

            // Create GCash Transaction Log
            GCashTransaction::create([
                'sale_id' => $sale->id,
                'sms_body' => $smsBody,
                'parsed_amount' => $amount,
                'parsed_ref' => $parsedRef,
                'matched' => true,
                'auto_confirmed' => true,
                'raw_payload' => json_encode($request->all())
            ]);

            // Update delivery status from created (or null) to pending, if it exists
            $delivery = $sale->delivery;
            if ($delivery) {
                if (in_array($delivery->status, ['created', 'waiting'])) {
                    $delivery->status = 'pending';
                    $delivery->save();
                }
            } else {
                $delivery = Delivery::create([
                    'sale_id' => $sale->id,
                    'status' => 'pending',
                ]);
            }

            // Send notification to customer
            CustomerNotification::create([
                'customer_id' => $sale->customer_id,
                'delivery_id' => $delivery ? $delivery->id : null,
                'title' => 'Payment Confirmed',
                'message' => "Your GCash payment of ₱" . number_format($amount, 2) . " for order #{$sale->order_number} has been received and confirmed.",
                'type' => 'payment_confirmed',
                'is_read' => false
            ]);

            // Send notification to admin users about GCash payment
            $admins = User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                $admin->notify(new GCashPaymentReceived($sale, $smsBody, $amount, $parsedPhone));
            }

            DB::commit();
            Log::info("Successfully auto-confirmed order #{$sale->order_number} for ₱{$amount}");
            
            return response()->json(['status' => 'success', 'sale_id' => $sale->id]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to confirm order #{$sale->id}: " . $e->getMessage());
            return response()->json(['error' => 'Server error'], 500);
        }
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
