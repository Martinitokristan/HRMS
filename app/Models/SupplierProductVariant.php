<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierProductVariant extends Model
{
    protected $fillable = [
        'supplier_product_id', 'size', 'color', 'weight',
        'price_override', 'stock', 'sku_suffix', 'image_path',
    ];

    public function supplierProduct()
    {
        return $this->belongsTo(SupplierProduct::class);
    }
}
