<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalesCancellationRequest extends Model
{
    protected $table = 'sales_cancellation_requests';

    protected $fillable = [
        'sale_id',
        'reason',
        'notes',
        'requested_by',
        'requested_at',
        'status',
        'admin_notes',
        'resolved_by',
        'resolved_at',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function requestedBy()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function resolvedBy()
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
