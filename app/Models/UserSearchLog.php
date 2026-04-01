<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserSearchLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'query',
        'results_count',
        'clicked_product_id',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function clickedProduct()
    {
        return $this->belongsTo(Product::class, 'clicked_product_id');
    }
}
