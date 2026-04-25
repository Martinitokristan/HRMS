<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    protected $fillable = [
        'order_number', 'customer_id', 'processed_by', 'discount_pct',
        'total_amount', 'payment_method', 'payment_phone_number', 'payment_reference', 'payment_proof_path', 'status', 'notes',
        'payment_confirmed_at', 'payment_expiry_sms_sent_at', 'payment_proof_token', 'payment_proof_token_used_at',
        'cancellation_status', 'cancellation_requested_at', 'cancellation_requested_by',
    ];

    protected $casts = [
        'payment_confirmed_at'      => 'datetime',
        'payment_expiry_sms_sent_at'=> 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function processedBy()
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function items()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function delivery()
    {
        return $this->hasOne(Delivery::class);
    }

    public function gcashTransaction()
    {
        return $this->hasOne(GCashTransaction::class);
    }

    // Normalized cancellation relationship
    public function cancellation()
    {
        return $this->hasOne(SalesCancellation::class, 'sale_id');
    }

    public function cancellationRequest()
    {
        return $this->hasOne(SalesCancellationRequest::class, 'sale_id');
    }

    // Check if sale is cancelled
    public function isCancelled()
    {
        return $this->cancellation()->exists();
    }
}
