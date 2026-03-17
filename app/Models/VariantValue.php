<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VariantValue extends Model
{
    protected $table = 'variant_values';
    protected $fillable = ['variant_id', 'label', 'hex_code', 'description', 'category'];

    public function variant()
    {
        return $this->belongsTo(Variant::class, 'variant_id');
    }
}
