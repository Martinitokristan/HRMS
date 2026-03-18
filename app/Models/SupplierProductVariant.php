<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierProductVariant extends Model
{
    protected $fillable = [
        'supplier_product_id', 'size', 'color', 'weight',
        'price_override', 'stock', 'barcode_suffix', 'image_path', 'additional_images',
    ];

    protected $casts = [
        'additional_images' => 'array',
    ];

    public function supplierProduct()
    {
        return $this->belongsTo(SupplierProduct::class);
    }
}
