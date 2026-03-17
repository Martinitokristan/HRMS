<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'sku', 'name', 'description', 'category_id', 'unit_type_id', 'supplier_id',
        'purchase_price', 'sell_price', 'image_path', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function unitType()
    {
        return $this->belongsTo(UnitType::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function inventory()
    {
        return $this->hasOne(Inventory::class);
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function purchaseOrderItems()
    {
        return $this->hasMany(POItem::class);
    }

    public function productVariants()
    {
        return $this->hasMany(ProductVariant::class);
    }

    /**
     * Synchronize the aggregate inventory stock with the sum of variant stocks.
     */
    public function syncStockWithVariants()
    {
        if ($this->productVariants()->exists()) {
            $totalStock = $this->productVariants()->sum('stock');
            $this->inventory()->updateOrCreate(
                ['product_id' => $this->id],
                ['current_stock' => $totalStock]
            );
        }
    }
}
