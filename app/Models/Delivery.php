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
        'delivery_fee', 'cash_collected', 'cash_remitted_at', 'cash_remitted_by',
        'customer_confirmed_at', 'customer_disputed_at', 'customer_dispute_reason',
        'payout_status', 'payout_eligible_at', 'paid_at', 'paid_by',
        'mark_delivered_lat', 'mark_delivered_lng', 'geofence_distance_m', 'geofence_flagged',
    ];

    protected $casts = [
        'pickup_at' => 'datetime',
        'delivered_at' => 'datetime',
        'rated_at' => 'datetime',
        'latitude' => 'float',
        'longitude' => 'float',
        'delivery_fee' => 'decimal:2',
        'cash_collected' => 'decimal:2',
        'cash_remitted_at' => 'datetime',
        'customer_confirmed_at' => 'datetime',
        'customer_disputed_at' => 'datetime',
        'payout_eligible_at' => 'datetime',
        'paid_at' => 'datetime',
        'mark_delivered_lat' => 'float',
        'mark_delivered_lng' => 'float',
        'geofence_distance_m' => 'integer',
        'geofence_flagged' => 'boolean',
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
