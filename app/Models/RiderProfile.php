<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RiderProfile extends Model
{
    protected $fillable = [
        'user_id', 'vehicle_type', 'plate_number',
        'availability', 'total_deliveries', 'on_time_count',
        'current_latitude', 'current_longitude',
        'valid_id_type', 'valid_id_path', 'license_number', 'address', 'interview_at'
    ];

    protected $appends = ['on_time_rate'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getOnTimeRateAttribute(): float
    {
        if ($this->total_deliveries === 0) return 0;
        return round(($this->on_time_count / $this->total_deliveries) * 100, 1);
    }
}
