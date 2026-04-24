<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RiderProfile extends Model
{
    protected $fillable = [
        // User information (denormalized)
        'user_id', 'name', 'email',
        // Vehicle information
        'vehicle_type', 'vehicle_model', 'plate_number',
        // Identification
        'id_type', 'id_number', 'id_file_path',
        'valid_id_type', 'valid_id_path', 'license_number',
        // Contact & Address
        'emergency_contact', 'address',
        // Location & Status
        'current_latitude', 'current_longitude', 'current_heading',
        'availability', 'interview_at',
    ];

    protected $appends = ['on_time_rate', 'total_deliveries', 'on_time_count'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Calculate total deliveries from actual deliveries
    public function getTotalDeliveriesAttribute(): int
    {
        return Delivery::where('rider_id', $this->user_id)
            ->where('status', 'delivered')
            ->count();
    }

    // Calculate on-time count from actual deliveries
    public function getOnTimeCountAttribute(): int
    {
        return Delivery::where('rider_id', $this->user_id)
            ->where('status', 'delivered')
            ->count();
    }

    public function getOnTimeRateAttribute(): float
    {
        $total = (int) $this->total_deliveries;
        if ($total <= 0) return 0;
        return round(($this->on_time_count / $total) * 100, 1);
    }
}
