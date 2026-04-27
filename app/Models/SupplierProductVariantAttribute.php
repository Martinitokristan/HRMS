<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierProductVariantAttribute extends Model
{
    protected $fillable = ['supplier_product_variant_id', 'variant_id', 'variant_value_id'];
    public function variant() { return $this->belongsTo(\App\Models\Variant::class); }
    public function variantValue() { return $this->belongsTo(\App\Models\VariantValue::class); }
}
