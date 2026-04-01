<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductSimilarity extends Model
{
    public $timestamps = false;

    protected $table = 'product_similarities';

    protected $fillable = [
        'product_id',
        'similar_product_id',
        'score',
        'algorithm',
        'computed_at',
    ];

    protected $casts = [
        'score' => 'float',
        'computed_at' => 'datetime',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function similarProduct()
    {
        return $this->belongsTo(Product::class, 'similar_product_id');
    }
}
