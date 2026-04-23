<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomerProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        // User reference
        'user_id',
        // User information (denormalized from users table)
        'name', 'email',
        // Personal info
        'age', 'sex',
        // Address fields (simple text, kept for legacy compatibility)
        'address', 'landmark', 'zip_code',
        // PSGC hierarchical fields (replaces old province/municipality)
        'region_code', 'region_name',
        'province_code', 'province_name',
        'city_code', 'city_name',
        'barangay_code', 'barangay_name',
        'street',
        // Geolocation
        'latitude', 'longitude'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
