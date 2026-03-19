<?php

namespace App\Http\Controllers;

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
            ->when($request->status && $request->status !== 'all', function ($q) use ($request) {
                return $q->where('status', $request->status);
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

        $reviews = $query->paginate($request->get('per_page', 15));

        $stats = [
            'total'    => ProductReview::count(),
            'pending'  => ProductReview::where('status', 'pending')->count(),
            'approved' => ProductReview::where('status', 'approved')->count(),
            'rejected' => ProductReview::where('status', 'rejected')->count(),
            'average_rating' => round(ProductReview::where('status', 'approved')->avg('rating'), 1),
        ];

        return response()->json([
            'data'   => $reviews,
            'stats'  => $stats,
            'status' => 'success',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id'         => 'required|exists:products,id',
            'product_variant_id' => 'nullable|exists:product_variants,id',
            'rating'             => 'required|integer|min:1|max:5',
            'title'              => 'nullable|string|max:100',
            'review_text'        => 'nullable|string|max:2000',
        ]);

        $customerId = $request->user()->id;

        // Check if customer already reviewed this product
        $existing = ProductReview::where('customer_id', $customerId)
            ->where('product_id', $data['product_id'])
            ->where(function ($q) use ($data) {
                if (isset($data['product_variant_id'])) {
                    $q->where('product_variant_id', $data['product_variant_id']);
                } else {
                    $q->whereNull('product_variant_id');
                }
            })
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'You have already reviewed this product.',
                'status'  => 'error',
            ], 422);
        }

        // Check if this is a verified purchase
        $verifiedPurchase = Sale::where('customer_id', $customerId)
            ->whereIn('status', ['delivered', 'returned'])
            ->whereHas('items', function ($q) use ($data) {
                $q->where('product_id', $data['product_id']);
                if (isset($data['product_variant_id'])) {
                    $q->where('product_variant_id', $data['product_variant_id']);
                }
            })
            ->first();

        // Handle image uploads
        $images = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                $images[] = $file->store('reviews', 'public');
            }
        }

        $review = ProductReview::create([
            'product_id'           => $data['product_id'],
            'product_variant_id'   => $data['product_variant_id'] ?? null,
            'customer_id'          => $customerId,
            'sale_id'              => $verifiedPurchase->id ?? null,
            'rating'               => $data['rating'],
            'title'                => $data['title'] ?? null,
            'review_text'          => $data['review_text'] ?? null,
            'images'               => $images,
            'is_verified_purchase' => $verifiedPurchase ? true : false,
            'status'               => 'approved', // Auto-approve for now
        ]);

        return response()->json([
            'data'    => $review->load(['customer', 'product']),
            'message' => 'Review submitted successfully!',
            'status'  => 'success',
        ], 201);
    }

    public function productReviews($productId, Request $request)
    {
        $query = ProductReview::with(['customer', 'productVariant'])
            ->where('product_id', $productId)
            ->approved();

        $sortBy = $request->get('sort', 'recent');
        if ($sortBy === 'helpful') {
            $query->orderBy('helpful_count', 'desc');
        } elseif ($sortBy === 'rating_high') {
            $query->orderBy('rating', 'desc');
        } elseif ($sortBy === 'rating_low') {
            $query->orderBy('rating', 'asc');
        } else {
            $query->latest();
        }

        $reviews = $query->paginate(10);

        // Rating summary
        $summary = ProductReview::where('product_id', $productId)
            ->approved()
            ->select('rating', DB::raw('count(*) as count'))
            ->groupBy('rating')
            ->pluck('count', 'rating')
            ->toArray();

        $totalReviews = array_sum($summary);
        $averageRating = $totalReviews > 0
            ? round(ProductReview::where('product_id', $productId)->approved()->avg('rating'), 1)
            : 0;

        return response()->json([
            'data' => $reviews,
            'summary' => [
                'average_rating' => $averageRating,
                'total_reviews'  => $totalReviews,
                'rating_breakdown' => [
                    5 => $summary[5] ?? 0,
                    4 => $summary[4] ?? 0,
                    3 => $summary[3] ?? 0,
                    2 => $summary[2] ?? 0,
                    1 => $summary[1] ?? 0,
                ],
            ],
            'status' => 'success',
        ]);
    }

    public function markHelpful(Request $request, $reviewId)
    {
        $data = $request->validate([
            'is_helpful' => 'required|boolean',
        ]);

        $customerId = $request->user()->id;
        $review = ProductReview::findOrFail($reviewId);

        // Upsert helpfulness
        $helpfulness = ReviewHelpfulness::updateOrCreate(
            ['review_id' => $reviewId, 'customer_id' => $customerId],
            ['is_helpful' => $data['is_helpful']]
        );

        // Recalculate helpful count
        $helpfulCount = ReviewHelpfulness::where('review_id', $reviewId)
            ->where('is_helpful', true)
            ->count();

        $review->update(['helpful_count' => $helpfulCount]);

        return response()->json([
            'data'    => ['helpful_count' => $helpfulCount],
            'message' => 'Thank you for your feedback!',
            'status'  => 'success',
        ]);
    }

    public function respond(Request $request, $reviewId)
    {
        $data = $request->validate([
            'admin_response' => 'required|string|max:1000',
        ]);

        $review = ProductReview::findOrFail($reviewId);
        $review->update(['admin_response' => $data['admin_response']]);

        return response()->json([
            'data'    => $review->fresh()->load(['customer', 'product']),
            'message' => 'Response added successfully.',
            'status'  => 'success',
        ]);
    }

    public function updateStatus(Request $request, $reviewId)
    {
        $data = $request->validate([
            'status' => 'required|in:pending,approved,rejected',
        ]);

        $review = ProductReview::findOrFail($reviewId);
        $review->update(['status' => $data['status']]);

        return response()->json([
            'data'    => $review->fresh()->load(['customer', 'product']),
            'message' => "Review {$data['status']}.",
            'status'  => 'success',
        ]);
    }

    public function destroy($reviewId)
    {
        $review = ProductReview::findOrFail($reviewId);
        $review->delete();

        return response()->json([
            'message' => 'Review deleted successfully.',
            'status'  => 'success',
        ]);
    }
}
