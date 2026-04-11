<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Address extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'region_code',   'region_name',
        'province_code', 'province_name',
        'city_code',     'city_name',
        'barangay_code', 'barangay_name',
        'street',
        'zip_code',
    ];

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}
