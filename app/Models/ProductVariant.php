<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id', 'size_value_id', 'color_value_id', 'weight_value_id',
        'stock', 'price_override', 'sku_suffix', 'image_path'
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function sizeValue()
    {
        return $this->belongsTo(VariantValue::class, 'size_value_id');
    }

    public function colorValue()
    {
        return $this->belongsTo(VariantValue::class, 'color_value_id');
    }

    public function weightValue()
    {
        return $this->belongsTo(VariantValue::class, 'weight_value_id');
    }
}
