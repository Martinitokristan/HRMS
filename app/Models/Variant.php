<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Variant extends Model
{
    protected $table = 'variants';
    protected $fillable = ['name', 'status', 'icon', 'description'];

    public function values()
    {
        return $this->hasMany(VariantValue::class, 'variant_id');
    }
}
