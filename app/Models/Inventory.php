<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Inventory extends Model
{
    public $timestamps = false;
    protected $table = 'inventory';
    protected $fillable = [
        'product_id',
        'product_variant_id',
        'supplier_product_id',
        'supplier_product_variant_id',
        'current_stock',
        'warehouse_stock',
        'reorder_threshold',
        'last_adjusted_at',
        'is_low_stock',
    ];
    protected $casts = [
        'last_adjusted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'is_low_stock' => 'boolean',
    ];
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

    public function supplierProductVariant()
    {
        return $this->belongsTo(SupplierProductVariant::class, 'supplier_product_variant_id');
    }

    public function isLowStock(): bool
    {
        // For orphans and variants, we primarily track warehouse_stock.
        // For standard local products, we track current_stock (storefront).
        $stock = (!$this->product_id || $this->product_variant_id) ? $this->warehouse_stock : $this->current_stock;
        return $stock <= $this->reorder_threshold;
    }

    protected static function booted()
    {
        // For regular Eloquent saves (create/update via setting attributes + save).
        static::saving(function (self $inventory) {
            $inventory->is_low_stock = ($inventory->current_stock <= $inventory->reorder_threshold);
        });
    }

    public function increment($column, $amount = 1, array $extra = [])
    {
        $extra = $this->withLowStockExtra($column, $amount, $extra, '+');
        return parent::increment($column, $amount, $extra);
    }

    public function decrement($column, $amount = 1, array $extra = [])
    {
        $extra = $this->withLowStockExtra($column, $amount, $extra, '-');
        return parent::decrement($column, $amount, $extra);
    }

    private function withLowStockExtra(string $column, $amount, array $extra, string $op): array
    {
        if (array_key_exists('is_low_stock', $extra)) {
            return $extra;
        }
        if ($column !== 'current_stock' && $column !== 'reorder_threshold') {
            return $extra;
        }

        $amount = (int) $amount;
        $stockExpr = $column === 'current_stock'
            ? "(current_stock {$op} {$amount})"
            : 'current_stock';
        $thresholdExpr = $column === 'reorder_threshold'
            ? "(reorder_threshold {$op} {$amount})"
            : 'reorder_threshold';

        $extra['is_low_stock'] = DB::raw("CASE WHEN {$stockExpr} <= {$thresholdExpr} THEN 1 ELSE 0 END");
        return $extra;
    }
}
