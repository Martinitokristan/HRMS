<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReturnsItem extends Model
{
    protected $table = 'returns_items';

    protected $fillable = [
        'return_id', 'sale_item_id', 'product_id',
        'quantity_returned', 'condition', 'item_reason',
    ];

    public function returnOrder()
    {
        return $this->belongsTo(ReturnOrder::class, 'return_id');
    }

    public function saleItem()
    {
        return $this->belongsTo(SaleItem::class, 'sale_item_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
