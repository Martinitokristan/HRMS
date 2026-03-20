<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewHelpfulness extends Model
{
    protected $table = 'review_helpfulness';

    protected $fillable = [
        'review_id', 'customer_id', 'is_helpful',
    ];

    protected $casts = [
        'is_helpful' => 'boolean',
    ];

    public function review()
    {
        return $this->belongsTo(ProductReview::class, 'review_id');
    }

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }
}
