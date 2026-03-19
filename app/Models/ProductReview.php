<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductReview extends Model
{
    protected $fillable = [
        'product_id', 'product_variant_id', 'customer_id', 'sale_id',
        'rating', 'title', 'review_text', 'images', 'helpful_count',
        'is_verified_purchase', 'status', 'admin_response',
    ];

    protected $casts = [
        'images' => 'array',
        'is_verified_purchase' => 'boolean',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function helpfulness()
    {
        return $this->hasMany(ReviewHelpfulness::class, 'review_id');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeForProduct($query, $productId)
    {
        return $query->where('product_id', $productId);
    }
}
