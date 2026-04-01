<?php

namespace App\Http\Controllers;

use App\Models\UserActivity;
use App\Models\UserSearchLog;
use App\Services\RecommendationService;
use Illuminate\Http\Request;

class RecommendationController extends Controller
{
    /**
     * GET /api/recommendations
     * Returns personalised product recommendations for the authenticated user.
     */
    public function index(Request $request, RecommendationService $service)
    {
        $limit = min((int) $request->input('limit', 8), 20);
        $products = $service->getRecommendations($request->user()->id, $limit);

        return response()->json([
            'data' => $products->values(),
        ]);
    }

    /**
     * POST /api/activity
     * Log a user activity event (view, cart_add, category_click, quick_view, wishlist_add).
     */
    public function logActivity(Request $request)
    {
        $request->validate([
            'action'           => 'required|in:view,cart_add,wishlist_add,category_click,quick_view',
            'product_id'       => 'nullable|integer|exists:products,id',
            'category_id'      => 'nullable|integer|exists:categories,id',
            'duration_seconds' => 'nullable|integer|min:0',
            'metadata'         => 'nullable|array',
        ]);

        UserActivity::create([
            'user_id'          => $request->user()->id,
            'product_id'       => $request->input('product_id'),
            'category_id'      => $request->input('category_id'),
            'action'           => $request->input('action'),
            'duration_seconds' => $request->input('duration_seconds'),
            'metadata'         => $request->input('metadata'),
            'created_at'       => now(),
        ]);

        return response()->json(['status' => 'ok'], 201);
    }

    /**
     * POST /api/search-log
     * Log a search query and optional clicked result.
     */
    public function logSearch(Request $request)
    {
        $request->validate([
            'query'              => 'required|string|max:255',
            'results_count'      => 'nullable|integer|min:0',
            'clicked_product_id' => 'nullable|integer|exists:products,id',
        ]);

        UserSearchLog::create([
            'user_id'            => $request->user()->id,
            'query'              => $request->input('query'),
            'results_count'      => $request->input('results_count', 0),
            'clicked_product_id' => $request->input('clicked_product_id'),
            'created_at'         => now(),
        ]);

        return response()->json(['status' => 'ok'], 201);
    }
}
