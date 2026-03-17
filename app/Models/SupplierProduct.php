<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierProduct extends Model
{
    protected $fillable = [
        'supplier_id', 'name', 'sku', 'description', 'category_id',
        'price', 'min_order_qty', 'image_path', 'is_promoted', 'status',
    ];

    protected $casts = [
        'is_promoted' => 'boolean',
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
