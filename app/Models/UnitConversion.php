<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UnitConversion extends Model
{
    protected $fillable = ['category_id', 'purchase_unit', 'sell_unit', 'conversion_factor'];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
