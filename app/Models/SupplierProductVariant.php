<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierProductVariant extends Model
{
    protected $fillable = [
        'supplier_product_id', 'size', 'color', 'weight',
        'price_override', 'stock', 'barcode', 'barcode_suffix', 
        'image_path', 'additional_images',
    ];

    protected $casts = [
        'additional_images' => 'array',
    ];

    public static $rules = [
        'barcode' => 'required|string|max:50',
        'image_path' => 'required|string',
        'additional_images' => 'required|array|size:2',
        'additional_images.*' => 'required|string|distinct'
    ];

    public function supplierProduct()
    {
        return $this->belongsTo(SupplierProduct::class);
    }
}
