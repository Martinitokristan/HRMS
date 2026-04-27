<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    protected $fillable = ['name'];

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function variantTypes()
    {
        return $this->hasMany(\App\Models\CategoryVariantType::class);
    }
}
