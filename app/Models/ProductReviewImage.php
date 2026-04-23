<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductReviewImage extends Model
{
    protected $table = 'product_review_images';

    protected $fillable = [
        'review_id', 'image_path', 'alt_text', 'sort_order',
    ];

    public function review()
    {
        return $this->belongsTo(ProductReview::class, 'review_id');
    }
}
