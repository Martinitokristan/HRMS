<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'phone', 'photo', 'role', 'status', 'password', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'last_login_at' => 'datetime',
    ];

    public function sales()
    {
        return $this->hasMany(Sale::class, 'customer_id');
    }


    public function deliveries()
    {
        return $this->hasMany(Delivery::class, 'rider_id');
    }

    public function riderProfile()
    {
        return $this->hasOne(RiderProfile::class);
    }

    public function customerProfile()
    {
        return $this->hasOne(CustomerProfile::class);
    }

}
