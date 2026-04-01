<?php

namespace App\Jobs;

use App\Models\Product;
use App\Services\GeminiBannerService;
use App\Services\RemoveBgService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessProductBannerImage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $productId;
    protected $imagePath;

    public $tries = 2;
    public $timeout = 120;

    /**
     * Create a new job instance.
     *
     * @param int    $productId
     * @param string $imagePath
     */
    public function __construct($productId, $imagePath)
    {
        $this->productId = $productId;
        $this->imagePath = $imagePath;
    }

    /**
     * Execute the job.
     */
    public function handle()
    {
        $product = Product::find($this->productId);

        if (!$product) {
            Log::warning('ProcessProductBannerImage: Product not found.', ['id' => $this->productId]);
            return;
        }

        if ($product->image_path !== $this->imagePath) {
            Log::info('ProcessProductBannerImage: Image changed since dispatch, skipping.', [
                'id' => $this->productId,
            ]);
            return;
        }

        $service = new RemoveBgService();
        $bannerPath = $service->process($this->imagePath);

        if ($bannerPath) {
            $product->update(['image_banner_path' => $bannerPath]);
            Log::info('ProcessProductBannerImage: Banner created.', [
                'id'     => $this->productId,
                'banner' => $bannerPath,
            ]);
        } else {
            Log::info('ProcessProductBannerImage: Banner generation failed, leaving null.', [
                'id' => $this->productId,
            ]);
        }

        $product->load('category');
        $categoryName = $product->category ? $product->category->name : 'default';
        $filenameSlug = pathinfo($this->imagePath, PATHINFO_FILENAME);

        $bgService = new GeminiBannerService();
        $bgPath = $bgService->generate($categoryName, $product->name, $filenameSlug);

        if ($bgPath) {
            $product->update(['banner_bg_path' => $bgPath]);
            Log::info('ProcessProductBannerImage: Background generated.', [
                'id' => $this->productId,
                'bg' => $bgPath,
            ]);
        } else {
            Log::info('ProcessProductBannerImage: Background generation failed, falling back to CSS gradient.', [
                'id' => $this->productId,
            ]);
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception)
    {
        Log::error('ProcessProductBannerImage: Job failed.', [
            'id'      => $this->productId,
            'message' => $exception->getMessage(),
        ]);
    }
}
