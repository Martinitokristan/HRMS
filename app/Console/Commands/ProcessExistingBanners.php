<?php

namespace App\Console\Commands;

use App\Jobs\ProcessProductBannerImage;
use App\Models\Product;
use Illuminate\Console\Command;

class ProcessExistingBanners extends Command
{
    protected $signature = 'banners:process-existing {--bg-only : Only generate AI backgrounds for products that already have a cutout}';
    protected $description = 'Dispatch banner jobs for products missing cutout or AI background';

    public function handle()
    {
        $bgOnly = $this->option('bg-only');

        if ($bgOnly) {
            $products = Product::whereNotNull('image_path')
                ->whereNotNull('image_banner_path')
                ->whereNull('banner_bg_path')
                ->get();
        } else {
            $products = Product::whereNotNull('image_path')
                ->where(function ($q) {
                    $q->whereNull('image_banner_path')
                      ->orWhereNull('banner_bg_path');
                })
                ->get();
        }

        $count = $products->count();

        if ($count === 0) {
            $this->info('No products need processing.');
            return 0;
        }

        foreach ($products as $product) {
            ProcessProductBannerImage::dispatch($product->id, $product->image_path);
            $this->line('Dispatched: ' . $product->name . ' (id=' . $product->id . ')');
        }

        $this->info('Done. Dispatched ' . $count . ' job(s).');
        return 0;
    }
}
