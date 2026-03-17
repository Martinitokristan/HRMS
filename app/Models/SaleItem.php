<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    public $timestamps = false;
    protected $fillable = ['sale_id', 'product_id', 'product_variant_id', 'quantity', 'unit_price', 'subtotal', 'variants'];

    protected $casts = [
        'variants' => 'array',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
