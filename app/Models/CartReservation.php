<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CartReservation extends Model
{
    protected $fillable = [
        'customer_id', 'product_id', 'product_variant_id',
        'quantity', 'status',
    ];

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public static function getReservedQuantity($productId, $variantId = null, $excludeCustomerId = null)
    {
        $query = static::where('product_id', $productId)
            ->where('status', 'active');

        if ($variantId) {
            $query->where('product_variant_id', $variantId);
        } else {
            $query->whereNull('product_variant_id');
        }

        if ($excludeCustomerId) {
            $query->where('customer_id', '!=', $excludeCustomerId);
        }

        return $query->sum('quantity');
    }

    // No expiration needed - reservations are only used during checkout
    // and converted immediately after successful order
}
