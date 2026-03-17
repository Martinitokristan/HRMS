<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UnitType extends Model
{
    protected $fillable = ['purchase_unit', 'sell_unit', 'multiplier'];

    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
