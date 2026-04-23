<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalesCancellation extends Model
{
    protected $table = 'sales_cancellations';

    protected $fillable = [
        'sale_id', 'reason', 'notes', 'cancelled_by', 'cancelled_at',
    ];

    protected $casts = [
        'cancelled_at' => 'datetime',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function cancelledBy()
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }
}
