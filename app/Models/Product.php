<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'barcode', 'name', 'description', 'category_id', 'brand_id', 'unit_type_id', 'supplier_id',
        'purchase_price', 'sell_price', 'sale_percentage', 'image_path', 'image_banner_path', 'banner_bg_path', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];
    protected $appends = ['available_stock'];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
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
        return $this->hasOne(Inventory::class)->whereNull('product_variant_id');
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

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }

    public function approvedReviews()
    {
        return $this->hasMany(ProductReview::class)->where('status', 'approved');
    }

    public function averageRating()
    {
        return $this->approvedReviews()->avg('rating') ?? 0;
    }

    public function totalReviews()
    {
        return $this->approvedReviews()->count();
    }

    /**
     * Get the available stock (storefront stock) for the product.
     */
    public function getAvailableStockAttribute()
    {
        return $this->inventory ? $this->inventory->current_stock : 0;
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
