<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductSimilarity;
use App\Services\RecommendationService;
use Illuminate\Console\Command;

class SeedFirstRunRecommendations extends Command
{
    protected $signature = 'recommendations:seed-first-run';
    protected $description = 'Run the full recommendation compute on first deployment. Safe to re-run (uses updateOrCreate).';

    public function handle(RecommendationService $service)
    {
        $productCount = Product::where('is_active', true)->count();
        $this->info("First-run seed: {$productCount} active products found.");

        if ($productCount === 0) {
            $this->warn('No active products in the database. Nothing to compute.');
            return 0;
        }

        $this->info('Computing product similarities (this may take a moment)...');

        $startTime = microtime(true);
        $count = $service->computeSimilarities();
        $elapsed = round(microtime(true) - $startTime, 2);

        $totalRows = ProductSimilarity::count();

        $this->info("Computed {$count} similarity pairs for {$productCount} products in {$elapsed}s.");
        $this->info("Total rows in product_similarities: {$totalRows}");
        $this->info('First-run seed complete. Safe to re-run without duplicating data.');

        return 0;
    }
}
