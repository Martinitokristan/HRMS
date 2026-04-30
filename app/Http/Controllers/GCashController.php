<?php

namespace App\Http\Controllers;

use App\Services\GCash\GCashPaymentService;
use App\Services\GCash\GCashProofService;
use Illuminate\Http\Request;

class GCashController extends Controller
{

    /**
     * Webhook endpoint to receive SMS forwarded from Android.
     */
    public function smsWebhook(Request $request, GCashPaymentService $paymentService)
    {
        $secret = env('GCASH_SMS_SECRET');
        $providedSecret = $request->header('X-SMS-Secret');

        if (empty($secret) || !is_string($providedSecret) || !hash_equals((string) $secret, $providedSecret)) {
            \Illuminate\Support\Facades\Log::warning('Unauthorized SMS Webhook attempt', ['ip' => $request->ip()]);
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $smsBody = $request->input('content') ?? $request->input('message') ?? $request->input('body') ?? '';

        if (empty($smsBody)) {
            $smsBody = $request->getContent();
        }

        \Illuminate\Support\Facades\Log::info('Received GCash SMS:', ['body' => $smsBody]);

        $result = $paymentService->processSmsWebhook($smsBody, $request->all());

        return response()->json($result['data'], $result['status_code']);
    }

    /**
     * Public: Get order details by proof token (no auth required).
     */
    public function getProofOrder(Request $request, string $token, GCashProofService $proofService)
    {
        $result = $proofService->getProofOrder($token);

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']], $result['status_code']);
        }

        if (isset($result['data']['status']) && $result['data']['status'] === 'error') {
            return response()->json($result['data'], $result['status_code']);
        }

        return response()->json($result['data'], $result['status_code']);
    }

    /**
     * Public: Submit GCash payment proof via token link (no auth required).
     */
    public function submitProof(Request $request, string $token, GCashProofService $proofService)
    {
        $data = $request->validate([
            'payment_reference' => 'required|string|max:50',
            'payment_proof' => 'required|image|mimes:jpeg,jpg,png,webp|max:5120|dimensions:max_width=4000,max_height=4000',
        ]);

        $result = $proofService->submitProof($token, $data['payment_reference'], $request->file('payment_proof'));

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']], $result['status_code']);
        }

        return response()->json($result['data'], $result['status_code']);
    }

    /**
     * Polling endpoint for frontend to check if order was confirmed.
     */
    public function checkStatus(Request $request, $saleId, GCashPaymentService $paymentService)
    {
        $result = $paymentService->checkStatus($request->user()->id, $saleId);

        return response()->json($result['data'], $result['status_code']);
    }

    /**
     * Admin endpoint to fetch all GCash Transactions.
     */
    public function index(Request $request, GCashProofService $proofService)
    {
        $matched = null;
        if ($request->has('matched')) {
            $matched = $request->matched === 'true' || $request->matched === '1';
        }

        $result = $proofService->index($matched, $request->get('per_page', 20));

        return response()->json($result['data'], $result['status_code']);
    }
}
