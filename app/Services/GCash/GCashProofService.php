<?php

namespace App\Services\GCash;

use App\Models\Sale;
use App\Models\GCashTransaction;
use App\Events\DataMutated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class GCashProofService
{
    /**
     * Get order details by proof token (public endpoint).
     */
    public function getProofOrder($token)
    {
        $sale = Sale::where('payment_proof_token', $token)
            ->whereIn('status', ['pending_payment', 'verifying_payment'])
            ->with(['customer', 'items.product'])
            ->first();

        if (!$sale) {
            return [
                'error' => 'Invalid or expired link.',
                'status_code' => 404,
            ];
        }

        if ($sale->payment_proof_token_used_at !== null) {
            return [
                'data' => [
                    'message' => 'This proof link has already been used.',
                    'status' => 'error',
                ],
                'status_code' => 410,
            ];
        }

        return [
            'data' => [
                'order_number' => $sale->order_number,
                'total_amount' => $sale->total_amount,
                'status' => $sale->status,
                'customer_name' => optional($sale->customer)->name ?? 'Customer',
                'items' => $sale->items->map(fn($i) => [
                    'name' => $i->product->name ?? 'Item',
                    'quantity' => $i->quantity,
                ]),
                'already_submitted' => !is_null($sale->payment_proof_path),
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Submit payment proof via token link (public endpoint).
     */
    public function submitProof($token, $paymentReference, $proofFile)
    {
        $storedPath = null;

        try {
            $matched = true;

            DB::transaction(function () use ($token, $paymentReference, $proofFile, &$storedPath, &$matched) {
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

                $storedPath = $proofFile->store('payment_proofs', 'public');

                $sale->update([
                    'payment_reference' => $paymentReference,
                    'payment_proof_path' => $storedPath,
                    'status' => 'verifying_payment',
                    'payment_proof_token_used_at' => now(),
                ]);
            });

            if (!$matched) {
                return [
                    'error' => 'Invalid link or proof already submitted.',
                    'status_code' => 404,
                ];
            }
        } catch (\Throwable $e) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $e;
        }

        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'payment.proof_submitted'));

        Log::info("Proof submitted via token link.", ['token' => $token]);

        return [
            'data' => [
                'message' => 'Proof submitted successfully. Our admin will verify your payment shortly.',
                'status' => 'success',
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Admin list all GCash transactions.
     */
    public function index($matched = null, $perPage = 20)
    {
        $query = GCashTransaction::with('sale.customer')->orderBy('created_at', 'desc');

        if (!is_null($matched)) {
            $query->where('matched', $matched === true || $matched === 'true' || $matched === '1');
        }

        $logs = $query->paginate($perPage);

        return [
            'data' => $logs,
            'status_code' => 200,
        ];
    }
}
