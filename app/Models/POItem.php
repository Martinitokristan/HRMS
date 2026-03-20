<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class POItem extends Model
{
    public $timestamps = false;
    protected $table = 'purchase_order_items';
    protected $fillable = [
        'purchase_order_id', 'product_id', 'product_variant_id', 
        'supplier_product_id', 'supplier_product_variant_id',
        'quantity', 'unit_cost', 'subtotal'
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function supplierProduct()
    {
        return $this->belongsTo(SupplierProduct::class, 'supplier_product_id');
    }

    public function supplierProductVariant()
    {
        return $this->belongsTo(SupplierProductVariant::class, 'supplier_product_variant_id');
    }
}
