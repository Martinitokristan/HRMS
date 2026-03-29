<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GCashTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id', 'sms_body', 'parsed_amount', 'matched', 'auto_confirmed', 'raw_payload'
    ];

    protected $casts = [
        'matched' => 'boolean',
        'auto_confirmed' => 'boolean',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }
}
