<?php

namespace App\Services\Sales;

use App\Events\DataMutated;
use App\Models\Sale;
use App\Models\Setting;

class GcashProofService
{
    /**
     * Upload GCash proof of payment.
     */
    public function uploadProof($sale, $user, $file, $reference = null)
    {
        // Authorization: must be owner
        if ($sale->customer_id !== $user->id) {
            return [
                'error' => 'Unauthorized',
                'status_code' => 403,
            ];
        }

        if ($sale->payment_method !== 'gcash') {
            return [
                'error' => 'Only GCash orders can upload proof here.',
                'status_code' => 422,
            ];
        }

        $path = $file->store('payment_proofs', 'public');

        $sale->update([
            'payment_proof_path' => $path,
            'payment_reference' => $reference,
            'status' => 'verifying_payment'
        ]);

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard'], 'sale.payment_proof_uploaded'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders'], 'sale.payment_proof_uploaded'));

        return [
            'sale' => $sale->fresh(),
            'status_code' => 200,
        ];
    }
}
