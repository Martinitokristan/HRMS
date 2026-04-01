<?php

namespace App\Console\Commands;

use App\Services\RecommendationService;
use Illuminate\Console\Command;

class ComputeRecommendations extends Command
{
    protected $signature = 'recommendations:compute';
    protected $description = 'Compute product similarity scores for the recommendation engine';

    public function handle(RecommendationService $service)
    {
        $this->info('Computing product similarities...');

        $startTime = microtime(true);
        $count = $service->computeSimilarities();
        $elapsed = round(microtime(true) - $startTime, 2);

        $this->info("Done. Computed {$count} similarity pairs in {$elapsed}s.");

        return 0;
    }
}
