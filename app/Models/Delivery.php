<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Delivery extends Model
{
    protected $fillable = [
        'sale_id', 'rider_id', 'status', 'address',
        'pickup_at', 'delivered_at', 'notes',
        'tracking_number', 'latitude', 'longitude',
        'rating', 'rating_comment', 'rated_at', 'proof_photo',
    ];

    protected $casts = [
        'pickup_at' => 'datetime',
        'delivered_at' => 'datetime',
        'rated_at' => 'datetime',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function rider()
    {
        return $this->belongsTo(User::class, 'rider_id');
    }
}
