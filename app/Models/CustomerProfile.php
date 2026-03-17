<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomerProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'age', 'sex', 'address', 'landmark', 'province', 'municipality', 'zip_code', 'latitude', 'longitude'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
