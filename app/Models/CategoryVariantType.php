<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CategoryVariantType extends Model
{
    protected $fillable = ['category_id', 'variant_id', 'is_required', 'sort_order'];
    public function variant() { return $this->belongsTo(\App\Models\Variant::class); }
    public function category() { return $this->belongsTo(\App\Models\Category::class); }
}
