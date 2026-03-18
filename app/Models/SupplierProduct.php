<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierProduct extends Model
{
    protected $fillable = [
        'supplier_id', 'name', 'barcode', 'description', 'category_id',
        'price', 'min_order_qty', 'total_stock', 'base_size', 'image_path', 'additional_images', 'is_promoted', 'status',
    ];

    protected $casts = [
        'is_promoted'       => 'boolean',
        'additional_images' => 'array',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function variants()
    {
        return $this->hasMany(SupplierProductVariant::class);
    }
}
