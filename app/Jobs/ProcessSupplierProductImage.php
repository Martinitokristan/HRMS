<?php

namespace App\Jobs;

use App\Models\SupplierProduct;
use App\Services\RemoveBgService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessSupplierProductImage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $supplierProductId;
    
    public $tries = 2;
    public $timeout = 120;

    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct($supplierProductId)
    {
        $this->supplierProductId = $supplierProductId;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        Log::info('ProcessSupplierProductImage: Handle started for ID ' . $this->supplierProductId);
        $product = SupplierProduct::find($this->supplierProductId);

        if (!$product) {
            Log::warning('ProcessSupplierProductImage: Product not found.', ['id' => $this->supplierProductId]);
            return;
        }

        $service = new RemoveBgService();
        $updated = false;

        // Process main image
        if ($product->image_path && !str_starts_with($product->image_path, 'supplier-products/processed_')) {
            Log::info('ProcessSupplierProductImage: Processing main image', ['path' => $product->image_path]);
            $processedPath = $service->process($product->image_path, 'supplier-products', 'processed_');
            
            if ($processedPath) {
                $oldPath = $product->image_path;
                $product->image_path = $processedPath;
                $updated = true;
                
                // Optionally delete old image to save space
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }
            }
        }

        // Process additional images
        if (!empty($product->additional_images) && is_array($product->additional_images)) {
            $newAdditionalImages = [];
            foreach ($product->additional_images as $imgPath) {
                if ($imgPath && !str_starts_with($imgPath, 'supplier-products/processed_')) {
                    Log::info('ProcessSupplierProductImage: Processing additional image', ['path' => $imgPath]);
                    $processedPath = $service->process($imgPath, 'supplier-products', 'processed_');
                    
                    if ($processedPath) {
                        $newAdditionalImages[] = $processedPath;
                        $updated = true;
                        
                        if (Storage::disk('public')->exists($imgPath)) {
                            Storage::disk('public')->delete($imgPath);
                        }
                    } else {
                        $newAdditionalImages[] = $imgPath; // keep original if failed
                    }
                } else {
                    $newAdditionalImages[] = $imgPath; // already processed
                }
            }
            
            if ($updated) {
                $product->additional_images = $newAdditionalImages;
            }
        }

        if ($updated) {
            $product->save();
            Log::info('ProcessSupplierProductImage: Product images updated.', ['id' => $product->id]);
        }
    }
}
