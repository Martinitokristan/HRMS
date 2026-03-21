<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RiderProfile extends Model
{
    protected $fillable = [
        'user_id', 'vehicle_type', 'vehicle_model', 'plate_number',
        'availability', 'total_deliveries', 'on_time_count',
        'current_latitude', 'current_longitude', 'current_heading',
        'valid_id_type', 'valid_id_path', 'license_number', 'address', 'interview_at',
        'id_type', 'id_number', 'id_file_path', 'emergency_contact'
    ];

    protected $appends = ['on_time_rate'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getOnTimeRateAttribute(): float
    {
        $total = (int) $this->total_deliveries;
        if ($total <= 0) return 0;
        return round(($this->on_time_count / $total) * 100, 1);
    }
}
