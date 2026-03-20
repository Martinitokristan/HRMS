<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    protected $fillable = [
        'po_number', 'supplier_id', 'created_by', 'is_auto',
        'status', 'expected_date', 'total_cost',
        'rejection_reason', 'accepted_at',
        'delivered_at', 'delivered_by', 'delivery_notes',
    ];

    protected $casts = ['is_auto' => 'boolean'];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items()
    {
        return $this->hasMany(POItem::class, 'purchase_order_id');
    }
}
