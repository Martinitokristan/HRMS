<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Sale;
use App\Models\User;
use App\Models\GCashTransaction;
use App\Models\Delivery;
use App\Models\CustomerNotification;
use App\Events\DataMutated;
use App\Notifications\GCashPaymentReceived;
use App\Services\BrevoSmsService;
use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
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
                                ->where(function($q) use ($phoneVariants) {
                                    $q->whereIn('payment_phone_number', $phoneVariants);
                                })
                                ->orderBy('created_at', 'asc')
                                ->first();
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
            Cache::tags(['products'])->flush();

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

            // Broadcast real-time update so customer's order list and notifications refresh instantly
            broadcast(new DataMutated(
                "private-customer.{$sale->customer_id}",
                ['customer_orders', 'customer_notifications'],
                'payment.confirmed'
            ));
            broadcast(new DataMutated(
                'private-admin',
                ['admin_orders', 'admin_dashboard'],
                'payment.confirmed'
            ));

            // Send SMS to customer if enabled in settings
            try {
                $smsEnabled = Setting::get('sms_enabled', '0');
                $gcashSmsEnabled = Setting::get('gcash_confirmed_sms', '0');
                if ($smsEnabled === '1' && $gcashSmsEnabled === '1') {
                    $customer = $sale->customer;
                    $customerPhone = $sale->payment_phone_number ?? $customer->phone ?? null;
                    if ($customerPhone) {
                        $customerName = $customer->name ?? 'Valued Customer';
                        $sale->loadMissing('items.product');
                        $itemSummary = $sale->items->count() > 0
                            ? $sale->items->map(fn($i) => $i->quantity . 'x ' . ($i->product->name ?? 'Item'))->join(', ')
                            : "order #{$sale->order_number}";
                        $message = BrevoSmsService::gcashConfirmedMessage($customerName, $amount, $itemSummary);
                        BrevoSmsService::send($customerPhone, $message);
                    }
                }
            } catch (\Exception $smsErr) {
                Log::warning('GCash confirmed SMS failed: ' . $smsErr->getMessage());
            }
            
            return response()->json(['status' => 'success', 'sale_id' => $sale->id]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to confirm order #{$sale->id}: " . $e->getMessage());
            return response()->json(['error' => 'Server error'], 500);
        }
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

        return response()->json([
            'order_number'  => $sale->order_number,
            'total_amount'  => $sale->total_amount,
            'status'        => $sale->status,
            'customer_name' => $sale->customer->name ?? 'Customer',
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
        $sale = Sale::where('payment_proof_token', $token)
            ->where('status', 'pending_payment')
            ->first();

        if (!$sale) {
            return response()->json(['error' => 'Invalid link or proof already submitted.'], 404);
        }

        $request->validate([
            'payment_reference' => 'required|string|max:50',
            'payment_proof'     => 'required|image|max:5120',
        ]);

        $path = $request->file('payment_proof')->store('payment_proofs', 'public');

        $sale->update([
            'payment_reference' => $request->payment_reference,
            'payment_proof_path'=> $path,
            'status'            => 'verifying_payment',
        ]);

        // Notify admin in real-time
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'payment.proof_submitted'));

        Log::info("Proof submitted for order #{$sale->order_number} via token link.");

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
