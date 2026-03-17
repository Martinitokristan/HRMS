<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    protected $fillable = [
        'order_number', 'customer_id', 'processed_by', 'discount_pct',
        'total_amount', 'payment_method', 'status', 'notes',
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
}
