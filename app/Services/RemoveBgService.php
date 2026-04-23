<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class RemoveBgService
{
    /**
     * Remove background from an image and save as transparent PNG.
     *
     * @param string $imagePath Relative path inside storage/app/public (e.g. "products/abc.jpg")
     * @param string $outputDir Relative path to output directory
     * @param string $prefix    Prefix for the output filename
     * @return string|null Relative path to the transparent PNG, or null on failure
     */
    public function process($imagePath, $outputDir = 'products/banner', $prefix = 'banner_')
    {
        Log::info('RemoveBgService: process() called for ' . $imagePath);
        $apiKey = config('services.removebg.key');

        if (empty($apiKey)) {
            Log::error('RemoveBgService: API key is MISSING or empty in config. Ensure REMOVEBG_API_KEY is set in Railway Variables.');
            return null;
        }

        $fullPath = storage_path('app/public/' . $imagePath);

        if (!file_exists($fullPath)) {
            Log::warning('RemoveBgService: Source image not found.', ['path' => $fullPath]);
            return null;
        }

        try {
            Log::info('RemoveBgService: Processing image', ['path' => $imagePath, 'size' => filesize($fullPath)]);
            
            $response = Http::withHeaders([
                'X-Api-Key' => $apiKey,
            ])->attach(
                'image_file',
                file_get_contents($fullPath),
                basename($fullPath)
            )->post('https://api.remove.bg/v1.0/removebg', [
                'size' => 'preview',
            ]);

            Log::info('RemoveBgService: API response', [
                'status' => $response->status(),
                'headers' => $response->headers(),
                'body_size' => strlen($response->body()),
            ]);

            if (!$response->successful()) {
                Log::error('RemoveBgService: API returned error.', [
                    'status' => $response->status(),
                    'body'   => substr($response->body(), 0, 500),
                ]);
                return null;
            }
            
            // Validate response is actually an image
            $body = $response->body();
            if (empty($body) || strlen($body) < 100) {
                Log::error('RemoveBgService: Response too small or empty', ['size' => strlen($body)]);
                return null;
            }
            
            // Check if response looks like an error message instead of image
            $sample = substr($body, 0, 50);
            if (strpos($sample, '{') === 0 || strpos($sample, '<') === 0) {
                Log::error('RemoveBgService: Response looks like text/error instead of image', ['sample' => $sample]);
                return null;
            }

            $bannerDir = $outputDir;
            if (!Storage::disk('public')->exists($bannerDir)) {
                Storage::disk('public')->makeDirectory($bannerDir);
            }

            $filename = pathinfo($imagePath, PATHINFO_FILENAME);
            $bannerRelPath = $bannerDir . '/' . $prefix . $filename . '.png';

            Storage::disk('public')->put($bannerRelPath, $body);
            
            Log::info('RemoveBgService: Image saved successfully', ['path' => $bannerRelPath, 'size' => strlen($body)]);

            return $bannerRelPath;
        } catch (\Exception $e) {
            Log::error('RemoveBgService: Exception during processing.', [
                'message' => $e->getMessage(),
                'image'   => $imagePath,
            ]);
            return null;
        }
    }
}
