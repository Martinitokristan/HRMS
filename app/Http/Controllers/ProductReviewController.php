<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Models\ProductReview;
use App\Models\ReviewHelpfulness;
use App\Models\Sale;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductReviewController extends Controller
{
    public function index(Request $request)
    {
        $query = ProductReview::with(['product', 'customer', 'productVariant'])
            ->when($request->rating_filter && $request->rating_filter !== 'all', function ($q) use ($request) {
                if ($request->rating_filter === 'good') {
                    return $q->where('rating', '>=', 4);
                } elseif ($request->rating_filter === 'low') {
                    return $q->where('rating', '<=', 3);
                }
                return $q;
            })
            ->when($request->product_id, function ($q) use ($request) {
                return $q->where('product_id', $request->product_id);
            })
            ->when($request->search, function ($q) use ($request) {
                return $q->whereHas('customer', function ($cq) use ($request) {
                    $cq->where('name', 'like', "%{$request->search}%");
                })->orWhereHas('product', function ($pq) use ($request) {
                    $pq->where('name', 'like', "%{$request->search}%");
                });
            })
            ->latest();

        $reviews = $query->paginate($request->get('per_page', 10)); // Changed to 10 per page limit

        // Get global review stats
        $stats = [
            'total' => ProductReview::count(),
            'good' => ProductReview::where('rating', '>=', 4)->count(),
            'low' => ProductReview::where('rating', '<=', 3)->count(),
            'average' => round(ProductReview::avg('rating') ?? 0, 1),
        ];

        return response()->json([
            'data' => $reviews,
            'stats' => $stats,
            'status' => 'success',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'product_variant_id' => 'nullable|exists:product_variants,id',
            'rating' => 'required|integer|min:1|max:5',
            'title' => 'nullable|string|max:200',
            'review' => 'nullable|string|max:1000',
        ]);

        // Debug logging
        \Log::info('ProductReview Store - Validated data:', $data);
        \Log::info('ProductReview Store - Title:', [$data['title'] ?? 'NULL']);
        \Log::info('ProductReview Store - Review:', [$data['review'] ?? 'NULL']);

        $customerId = $request->user()->id;

        // Check eligibility
        $hasDeliveredOrder = Sale::where('customer_id', $customerId)
            ->where('status', 'delivered')
            ->whereHas('items', function ($q) use ($data) {
                $q->where('product_id', $data['product_id']);
            })
            ->exists();

        if (!$hasDeliveredOrder) {
            return response()->json([
                'message' => 'You can only review products from delivered orders',
                'status' => 'error'
            ], 403);
        }

        // Check if already reviewed
        $alreadyReviewed = ProductReview::where('customer_id', $customerId)
            ->where('product_id', $data['product_id'])
            ->exists();

        if ($alreadyReviewed) {
            return response()->json([
                'message' => 'You have already reviewed this product',
                'status' => 'error'
            ], 422);
        }

        // Auto-approve reviews for customers with delivered orders
        $reviewData = [
            'customer_id' => $customerId,
            'product_id' => $data['product_id'],
            'product_variant_id' => $data['product_variant_id'] ?? null,
            'rating' => $data['rating'],
            'title' => $data['title'] ?? null,
            'review_text' => $data['review'] ?? null,
            'status' => 'approved', // Auto-approve for delivered orders
        ];

        \Log::info('ProductReview Store - Review data to create:', $reviewData);

        $review = ProductReview::create($reviewData);

        \Log::info('ProductReview Store - Created review:', $review->toArray());

        broadcast(new DataMutated('private-admin', ['admin_reviews', 'admin_dashboard'], 'review.created'));
        broadcast(new DataMutated('shop', ['customer_shop'], 'review.created'));

        return response()->json([
            'data' => $review->load(['customer', 'product', 'productVariant']),
            'message' => 'Review submitted successfully and is now visible!',
            'status' => 'success',
        ]);
    }

    public function soldCount($productId)
    {
        // Calculate total sold quantity for this product
        $totalSold = \App\Models\SaleItem::where('product_id', $productId)
            ->whereHas('sale', function ($query) {
                $query->whereIn('status', ['delivered', 'completed', 'processing']);
            })
            ->sum('quantity');

        return response()->json([
            'sold_count' => (int) $totalSold,
            'status' => 'success'
        ]);
    }

    public function update(Request $request, $id)
    {
        $review = ProductReview::findOrFail($id);

        $data = $request->validate([
            'rating' => 'sometimes|integer|min:1|max:5',
            'review' => 'sometimes|nullable|string|max:1000',
            'status' => 'sometimes|in:pending,approved,rejected',
        ]);

        $review->update($data);

        broadcast(new DataMutated('private-admin', ['admin_reviews'], 'review.updated'));
        broadcast(new DataMutated('shop', ['customer_shop'], 'review.updated'));

        return response()->json([
            'data' => $review->load(['customer', 'product']),
            'message' => 'Review updated successfully',
            'status' => 'success',
        ]);
    }

    public function destroy($id)
    {
        $review = ProductReview::findOrFail($id);
        $review->delete();

        broadcast(new DataMutated('private-admin', ['admin_reviews'], 'review.deleted'));
        broadcast(new DataMutated('shop', ['customer_shop'], 'review.deleted'));

        return response()->json([
            'message' => 'Review deleted successfully',
            'status' => 'success'
        ]);
    }

    public function publicReviews(Request $request)
    {
        $query = ProductReview::with(['customer', 'productVariant'])
            ->where('status', 'approved')
            ->when($request->product_id, function ($q) use ($request) {
                return $q->where('product_id', $request->product_id);
            })
            ->latest();

        $reviews = $query->paginate($request->get('per_page', 10));

        return response()->json([
            'data' => $reviews,
            'status' => 'success',
        ]);
    }

    public function productReviews($productId, Request $request)
{
    $query = ProductReview::with(['customer', 'productVariant'])
        ->where('product_id', $productId)
        ->where('status', 'approved');

    // Filter by variant if specified
    if ($request->has('variant') && $request->variant !== 'all') {
        if ($request->variant === 'base') {
            // Only show base product reviews (no variant)
            $query->whereNull('product_variant_id');
        } else {
            // Show reviews for specific variant
            $query->where('product_variant_id', $request->variant);
        }
    }

    // Filter by rating if specified
    if ($request->has('rating') && $request->rating !== 'all') {
        $query->where('rating', $request->rating);
    }

    // Apply filtering/sorting logic based on the unified filter parameter
    $filter = $request->get('filter', $request->get('sort', 'recent'));
    
    switch ($filter) {
        case 'helpful':
            $query->orderBy('helpful_count', 'desc')
                ->orderBy('created_at', 'desc');
            break;
        case 'rating_high':
            // Highest Rating is now defined as 4-5 stars
            $query->where('rating', '>=', 4)
                ->orderBy('created_at', 'desc');
            break;
        case 'rating_low':
            // Lowest Rating is now defined as 3 stars and below
            $query->where('rating', '<=', 3)
                ->orderBy('created_at', 'desc');
            break;
        case 'rating_4':
            $query->where('rating', 4)->orderBy('created_at', 'desc');
            break;
        case 'rating_3':
            $query->where('rating', 3)->orderBy('created_at', 'desc');
            break;
        case 'rating_2':
            $query->where('rating', 2)->orderBy('created_at', 'desc');
            break;
        case 'recent':
        default:
            $query->orderBy('created_at', 'desc');
            break;
    }

    $reviews = $query->paginate(10);

    // Calculate rating distribution for all approved reviews of this product
    $ratingDistribution = ProductReview::where('product_id', $productId)
        ->where('status', 'approved')
        ->selectRaw('rating, COUNT(*) as count')
        ->groupBy('rating')
        ->orderBy('rating', 'desc')
        ->pluck('count', 'rating')
        ->toArray();

    // Calculate summary statistics
    $allReviewsQuery = ProductReview::where('product_id', $productId)->where('status', 'approved');
    
    return response()->json([
        'data' => [
            'reviews' => $reviews,
            'rating_distribution' => $ratingDistribution,
            'summary' => [
                'average_rating' => $allReviewsQuery->avg('rating') ?? 0,
                'total_reviews' => $allReviewsQuery->count(),
                'rating_breakdown' => $ratingDistribution,
            ],
        ],
        'status' => 'success',
    ]);
}

    public function checkEligibility($productId, Request $request)
    {
        $customerId = request()->user()->id;
        $variantId = $request->query('variant_id');

        // Check if customer has a delivered order with this product
        $hasDeliveredOrder = Sale::where('customer_id', $customerId)
            ->where('status', 'delivered')
            ->whereHas('items', function ($q) use ($productId, $variantId) {
                $q->where('product_id', $productId);
                if ($variantId) {
                    $q->where('product_variant_id', $variantId);
                }
            })
            ->exists();

        // Check if customer already reviewed this product/variant combination
        $alreadyReviewedQuery = ProductReview::where('customer_id', $customerId)
            ->where('product_id', $productId);
        
        if ($variantId) {
            $alreadyReviewedQuery->where('product_variant_id', $variantId);
        } else {
            $alreadyReviewedQuery->whereNull('product_variant_id');
        }
        
        $alreadyReviewed = $alreadyReviewedQuery->exists();

        return response()->json([
            'can_review' => $hasDeliveredOrder && !$alreadyReviewed,
            'has_delivered_order' => $hasDeliveredOrder,
            'already_reviewed' => $alreadyReviewed,
            'status' => 'success'
        ]);
    }

    public function markHelpful($id, Request $request)
    {
        $review = ProductReview::findOrFail($id);
        $customerId = $request->user()->id;
        $isHelpful = $request->input('is_helpful', true);

        // Update or create the helpfulness record
        ReviewHelpfulness::updateOrCreate(
            ['review_id' => $id, 'customer_id' => $customerId],
            ['is_helpful' => $isHelpful]
        );

        // Recalculate total helpful count for this review
        $count = ReviewHelpfulness::where('review_id', $id)
            ->where('is_helpful', true)
            ->count();

        $review->update(['helpful_count' => $count]);

        return response()->json([
            'data' => ['helpful_count' => $count],
            'status' => 'success',
            'message' => 'Your feedback has been recorded!'
        ]);
    }
}
