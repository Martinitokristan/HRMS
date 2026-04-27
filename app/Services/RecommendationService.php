<?php

namespace App\Services;


use App\Models\Product;
use App\Models\ProductSimilarity;
use App\Models\SaleItem;
use App\Models\UserActivity;
use App\Models\UserSearchLog;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RecommendationService
{
    /**
     * Minimum activity records before personalised recommendations kick in.
     */
    const COLD_START_THRESHOLD = 5;

    /**
     * Attach the same aggregates that ProductController::index attaches so
     * product cards rendered from recommendations show real sold / rating /
     * review counts instead of zeros. Every Product query in this service
     * MUST go through this method.
     */
    protected function withProductAggregates($query)
    {
        return $query
            ->with(['category', 'inventory', 'brand', 'productVariants'])
            ->withCount('approvedReviews as total_reviews')
            ->withAvg('approvedReviews as average_rating', 'rating')
            ->addSelect([
                'sold_count' => \Illuminate\Support\Facades\DB::table('sale_items')
                    ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                    ->whereColumn('sale_items.product_id', 'products.id')
                    ->whereNotNull('sales.was_confirmed_at')
                    ->selectRaw('COALESCE(SUM(sale_items.quantity), 0)'),
            ]);
    }

    /**
     * Normalise aggregate columns on a collection of products so the JSON
     * payload has the same shape as ProductController::index (floats / ints,
     * not nulls or DB strings).
     */
    protected function castProductAggregates(\Illuminate\Support\Collection $products): \Illuminate\Support\Collection
    {
        return $products->map(function ($p) {
            $p->average_rating = $p->average_rating !== null ? (float) $p->average_rating : null;
            $p->sold_count     = (int) ($p->sold_count ?? 0);
            $p->total_reviews  = (int) ($p->total_reviews ?? 0);
            return $p;
        });
    }

    /**
     * Get personalised recommendations for a user.
     *
     * @param int $userId
     * @param int $limit
     * @return \Illuminate\Support\Collection  Collection of Product models
     */
    public function getRecommendations(int $userId, int $limit = 8): Collection
    {
        $activityCount = UserActivity::where('user_id', $userId)->count();

        // Build the exclusion set FIRST
        $excludedIds = $this->getExcludedProductIds($userId);

        if ($activityCount < self::COLD_START_THRESHOLD) {
            return $this->getTrendingProducts($excludedIds, $limit);
        }

        return $this->getPersonalisedProducts($userId, $excludedIds, $limit);
    }

    /**
     * Product IDs to exclude: already purchased (delivered) + currently in cart.
     */
    protected function getExcludedProductIds(int $userId): array
    {
        // Products already purchased and delivered
        $purchased = SaleItem::whereHas('sale', function ($q) use ($userId) {
            $q->where('customer_id', $userId)->where('status', 'delivered');
        })->pluck('product_id')->toArray();

        return $purchased;
    }

    /**
     * Cold-start / trending fallback.
     * Step 1: Most viewed products in last 7 days.
     * Step 2: If no activity data at all, highest sell_price products.
     */
    protected function getTrendingProducts(array $excludedIds, int $limit): Collection
    {
        $trending = UserActivity::select('product_id', DB::raw('COUNT(*) as view_count'))
            ->where('action', 'view')
            ->where('created_at', '>=', now()->subDays(7))
            ->whereNotNull('product_id')
            ->when(count($excludedIds) > 0, function ($q) use ($excludedIds) {
                $q->whereNotIn('product_id', $excludedIds);
            })
            ->groupBy('product_id')
            ->orderByDesc('view_count')
            ->limit($limit)
            ->pluck('product_id');

        if ($trending->isNotEmpty()) {
            $query = Product::whereIn('id', $trending)->where('is_active', true);
            $results = $this->withProductAggregates($query)
                ->get()
                ->sortBy(function ($p) use ($trending) {
                    return $trending->search($p->id);
                })
                ->values();
            return $this->castProductAggregates($results);
        }

        // Day-one fallback: highest sell_price
        $query = Product::where('is_active', true)
            ->when(count($excludedIds) > 0, function ($q) use ($excludedIds) {
                $q->whereNotIn('id', $excludedIds);
            });
        $results = $this->withProductAggregates($query)
            ->orderByDesc('sell_price')
            ->limit($limit)
            ->get();
        return $this->castProductAggregates($results);
    }

    /**
     * Full personalised hybrid recommendation.
     */
    protected function getPersonalisedProducts(int $userId, array $excludedIds, int $limit): Collection
    {
        // 1. Gather user's recently interacted product IDs (last 30 days)
        $recentProductIds = UserActivity::where('user_id', $userId)
            ->whereNotNull('product_id')
            ->where('created_at', '>=', now()->subDays(30))
            ->pluck('product_id')
            ->unique()
            ->values()
            ->toArray();

        // 2. Gather user's category affinities (weighted by action type)
        $categoryScores = $this->getCategoryAffinities($userId);

        // 3. Gather user's search keywords (last 30 days)
        $searchKeywords = UserSearchLog::where('user_id', $userId)
            ->where('created_at', '>=', now()->subDays(30))
            ->pluck('query')
            ->map(function ($q) {
                return strtolower(trim($q));
            })
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        // 4. Get candidates from product_similarities (collaborative + content)
        $similarityScores = [];
        if (count($recentProductIds) > 0) {
            $rows = ProductSimilarity::whereIn('product_id', $recentProductIds)
                ->where('algorithm', 'hybrid')
                ->orderByDesc('score')
                ->limit(100)
                ->get();

            foreach ($rows as $row) {
                $pid = $row->similar_product_id;
                if (in_array($pid, $excludedIds) || in_array($pid, $recentProductIds)) {
                    continue;
                }
                if (!isset($similarityScores[$pid])) {
                    $similarityScores[$pid] = 0;
                }
                $similarityScores[$pid] = max($similarityScores[$pid], $row->score);
            }
        }

        // 5. Build candidate pool: all active products not excluded and not recently interacted
        $allExcluded = array_unique(array_merge($excludedIds, $recentProductIds));
        $candidatesQuery = Product::where('is_active', true)
            ->when(count($allExcluded) > 0, function ($q) use ($allExcluded) {
                $q->whereNotIn('id', $allExcluded);
            });
        $candidates = $this->withProductAggregates($candidatesQuery)->get();

        // 6. Score each candidate
        $scored = [];
        foreach ($candidates as $product) {
            $score = 0.0;

            // 6a. Similarity score (0–1 range, weight: 3.0)
            if (isset($similarityScores[$product->id])) {
                $score += $similarityScores[$product->id] * 3.0;
            }

            // 6b. Category affinity (weight: 2.0)
            if ($product->category_id && isset($categoryScores[$product->category_id])) {
                $score += $categoryScores[$product->category_id] * 2.0;
            }

            // 6c. Search keyword match (weight: 1.5)
            if (count($searchKeywords) > 0) {
                $nameLower = strtolower($product->name);
                $descLower = strtolower($product->description ?? '');
                foreach ($searchKeywords as $keyword) {
                    if (str_contains($nameLower, $keyword) || str_contains($descLower, $keyword)) {
                        $score += 1.5;
                        break;
                    }
                }
            }

            // 6d. Sale boost (weight: 0.5)
            if ($product->sale_percentage > 0) {
                $score += 0.5;
            }

            // 6e. Review rating boost (weight: 0.3 * normalised rating)
            if (isset($product->average_rating) && $product->average_rating > 0) {
                $score += ($product->average_rating / 5.0) * 0.3;
            }

            if ($score > 0) {
                $scored[$product->id] = ['product' => $product, 'score' => $score];
            }
        }

        // Sort by score desc, take top $limit
        uasort($scored, function ($a, $b) {
            return $b['score'] <=> $a['score'];
        });

        $results = collect(array_slice($scored, 0, $limit))
            ->pluck('product')
            ->values();

        // If not enough personalised results, fill with trending
        if ($results->count() < $limit) {
            $allExcludedFinal = array_merge($excludedIds, $recentProductIds, $results->pluck('id')->toArray());
            $filler = $this->getTrendingProducts($allExcludedFinal, $limit - $results->count());
            $results = $results->merge($filler)->take($limit);
        }

        return $this->castProductAggregates(collect($results->values()));
    }

    /**
     * Build category affinity scores for a user, normalised 0–1.
     */
    protected function getCategoryAffinities(int $userId): array
    {
        $weights = [
            'view'           => 1.0,
            'quick_view'     => 0.5,
            'cart_add'       => 2.0,
            'wishlist_add'   => 1.5,
            'category_click' => 1.0,
        ];

        $rows = UserActivity::where('user_id', $userId)
            ->where('created_at', '>=', now()->subDays(30))
            ->select('category_id', 'action', DB::raw('COUNT(*) as cnt'))
            ->whereNotNull('category_id')
            ->groupBy('category_id', 'action')
            ->get();

        $scores = [];
        foreach ($rows as $row) {
            $catId = $row->category_id;
            $w = $weights[$row->action] ?? 1.0;
            if (!isset($scores[$catId])) {
                $scores[$catId] = 0;
            }
            $scores[$catId] += $row->cnt * $w;
        }

        // Normalise to 0–1
        $max = count($scores) > 0 ? max($scores) : 1;
        if ($max > 0) {
            foreach ($scores as &$v) {
                $v = $v / $max;
            }
        }

        return $scores;
    }

    /**
     * Compute product similarities (called by artisan command).
     * Hybrid = average of content-based + collaborative-based scores.
     * Uses updateOrCreate so safe to re-run.
     *
     * @return int  Number of similarity pairs computed
     */
    public function computeSimilarities(): int
    {
        $products = Product::where('is_active', true)->get(['id', 'category_id', 'sell_price', 'name']);
        $count = 0;
        $now = now();

        // Pre-fetch co-purchase matrix: products bought together
        $coPurchase = $this->buildCoPurchaseMatrix();

        $productList = $products->values();
        $total = $productList->count();

        for ($i = 0; $i < $total; $i++) {
            for ($j = $i + 1; $j < $total; $j++) {
                $a = $productList[$i];
                $b = $productList[$j];

                // Content-based score
                $contentScore = $this->contentSimilarity($a, $b);

                // Collaborative score (co-purchase)
                $collabScore = $coPurchase[$a->id][$b->id] ?? ($coPurchase[$b->id][$a->id] ?? 0.0);

                // Hybrid = weighted average
                $hybrid = ($contentScore * 0.4) + ($collabScore * 0.6);

                if ($hybrid < 0.05) {
                    continue; // Skip negligible pairs to keep table lean
                }

                ProductSimilarity::updateOrCreate(
                    [
                        'product_id' => $a->id,
                        'similar_product_id' => $b->id,
                        'algorithm' => 'hybrid',
                    ],
                    [
                        'score' => round($hybrid, 4),
                        'computed_at' => $now,
                    ]
                );

                // Store the reverse pair too for fast lookups
                ProductSimilarity::updateOrCreate(
                    [
                        'product_id' => $b->id,
                        'similar_product_id' => $a->id,
                        'algorithm' => 'hybrid',
                    ],
                    [
                        'score' => round($hybrid, 4),
                        'computed_at' => $now,
                    ]
                );

                $count++;
            }
        }

        return $count;
    }

    /**
     * Content-based similarity between two products.
     * Factors: same category (0.6), price proximity (0.4).
     */
    protected function contentSimilarity(Product $a, Product $b): float
    {
        $score = 0.0;

        // Same category
        if ($a->category_id && $a->category_id === $b->category_id) {
            $score += 0.6;
        }

        // Price proximity (1 - normalised difference)
        $maxPrice = max($a->sell_price, $b->sell_price, 1);
        $priceDiff = abs($a->sell_price - $b->sell_price);
        $priceProximity = 1 - ($priceDiff / $maxPrice);
        $score += $priceProximity * 0.4;

        return $score;
    }

    /**
     * Build co-purchase matrix from sale_items.
     * Returns [product_id_a][product_id_b] => normalised co-purchase score (0–1).
     */
    protected function buildCoPurchaseMatrix(): array
    {
        // Get all orders with their product lists
        $orders = SaleItem::select('sale_id', 'product_id')
            ->whereHas('sale', function ($q) {
                $q->whereIn('status', ['delivered', 'confirmed', 'out_for_delivery']);
            })
            ->get()
            ->groupBy('sale_id');

        $pairs = [];
        $maxCount = 1;

        foreach ($orders as $saleId => $items) {
            $productIds = $items->pluck('product_id')->unique()->values()->toArray();
            $n = count($productIds);
            for ($i = 0; $i < $n; $i++) {
                for ($j = $i + 1; $j < $n; $j++) {
                    $a = min($productIds[$i], $productIds[$j]);
                    $b = max($productIds[$i], $productIds[$j]);
                    if (!isset($pairs[$a])) {
                        $pairs[$a] = [];
                    }
                    if (!isset($pairs[$a][$b])) {
                        $pairs[$a][$b] = 0;
                    }
                    $pairs[$a][$b]++;
                    $maxCount = max($maxCount, $pairs[$a][$b]);
                }
            }
        }

        // Normalise to 0–1
        foreach ($pairs as $a => &$bArr) {
            foreach ($bArr as $b => &$count) {
                $count = $count / $maxCount;
            }
        }

        return $pairs;
    }
}
