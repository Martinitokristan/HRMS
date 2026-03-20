<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReturnOrder extends Model
{
    protected $table = 'returns';

    protected $fillable = [
        'return_number', 'sale_id', 'requested_by', 'approved_by',
        'reason', 'reason_details', 'status', 'refund_amount',
        'refund_method', 'items', 'images', 'admin_notes',
        'approved_at', 'rejected_at', 'completed_at',
    ];

    protected $casts = [
        'items'        => 'array',
        'images'       => 'array',
        'approved_at'  => 'datetime',
        'rejected_at'  => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function requestedBy()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
