<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    public $timestamps = false;
    protected $table = 'inventory';
    protected $fillable = [
        'product_id',
        'product_variant_id',
        'supplier_product_id',
        'current_stock',
        'warehouse_stock',
        'reorder_threshold',
        'last_adjusted_at',
    ];
    protected $casts = ['last_adjusted_at' => 'datetime'];
    protected $attributes = ['warehouse_stock' => 0];

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

    public function isLowStock(): bool
    {
        // For orphans and variants, we primarily track warehouse_stock.
        // For standard local products, we track current_stock (storefront).
        $stock = (!$this->product_id || $this->product_variant_id) ? $this->warehouse_stock : $this->current_stock;
        return $stock <= $this->reorder_threshold;
    }
}
