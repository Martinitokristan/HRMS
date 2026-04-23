<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReturnsImage extends Model
{
    protected $table = 'returns_images';

    protected $fillable = [
        'return_id', 'image_path', 'alt_text', 'sort_order', 'uploaded_at',
    ];

    protected $casts = [
        'uploaded_at' => 'datetime',
    ];

    public function returnOrder()
    {
        return $this->belongsTo(ReturnOrder::class, 'return_id');
    }
}
