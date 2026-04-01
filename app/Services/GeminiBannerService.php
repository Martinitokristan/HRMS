<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class GeminiBannerService
{
    private $width  = 1280;
    private $height = 400;

    /**
     * Generate a category-themed banner background using PHP GD (no external API).
     *
     * @param string $categoryName
     * @param string $productName
     * @param string $filenameSlug
     * @return string|null Relative path inside storage/app/public, or null on failure
     */
    public function generate($categoryName, $productName, $filenameSlug)
    {
        if (!extension_loaded('gd')) {
            Log::error('GeminiBannerService: GD extension not loaded.');
            return null;
        }

        try {
            $palette = $this->getPalette($categoryName, $productName);
            $seed    = crc32($filenameSlug . $productName);
            mt_srand($seed);

            $img = imagecreatetruecolor($this->width, $this->height);
            imagealphablending($img, true);

            $this->drawMetallicBase($img, $palette);
            $this->drawDiagonalStripes($img, $palette);
            $this->drawScatteredTriangles($img, $palette);
            $this->drawDotGrid($img, $palette);
            $this->drawCornerVignette($img);
            $this->drawAccentGlow($img, $palette);
            $this->addMetallicNoise($img);

            $bannerDir = 'products/banner';
            if (!Storage::disk('public')->exists($bannerDir)) {
                Storage::disk('public')->makeDirectory($bannerDir);
            }

            $bgRelPath = $bannerDir . '/bg_' . $filenameSlug . '.jpg';
            $fullPath  = storage_path('app/public/' . $bgRelPath);

            imagejpeg($img, $fullPath, 92);
            imagedestroy($img);

            Log::info('GeminiBannerService: Background generated locally.', [
                'product' => $productName,
                'path'    => $bgRelPath,
            ]);

            return $bgRelPath;
        } catch (\Exception $e) {
            Log::error('GeminiBannerService: Exception.', [
                'message' => $e->getMessage(),
                'product' => $productName,
            ]);
            return null;
        }
    }

    /**
     * Dark charcoal/slate metallic base with a diagonal gradient sweep.
     */
    private function drawMetallicBase($img, $palette)
    {
        $c1 = $palette['gradStart'];
        $c2 = $palette['gradEnd'];

        for ($y = 0; $y < $this->height; $y++) {
            for ($x = 0; $x < $this->width; $x++) {
                $diag = ($x / $this->width) * 0.7 + ($y / $this->height) * 0.3;
                $diag = $diag * $diag;
                $r = (int)($c1[0] + ($c2[0] - $c1[0]) * $diag);
                $g = (int)($c1[1] + ($c2[1] - $c1[1]) * $diag);
                $b = (int)($c1[2] + ($c2[2] - $c1[2]) * $diag);
                $col = imagecolorallocate($img, max(0, min(255, $r)), max(0, min(255, $g)), max(0, min(255, $b)));
                imagesetpixel($img, $x, $y, $col);
            }
        }
    }

    /**
     * Subtle diagonal metallic stripe lines across the background.
     */
    private function drawDiagonalStripes($img, $palette)
    {
        $a = $palette['accent'];
        $spacing = mt_rand(80, 130);
        $count   = (int)(($this->width + $this->height) / $spacing);

        for ($i = 0; $i < $count; $i++) {
            $offset = $i * $spacing + mt_rand(-15, 15);
            $alpha  = mt_rand(90, 110);
            $col    = imagecolorallocatealpha($img, $a[0], $a[1], $a[2], $alpha);
            imagesetthickness($img, 1);
            imageline($img, $offset, 0, $offset - $this->height, $this->height, $col);
        }
    }

    /**
     * Scattered triangle outlines — the signature 3D hardware style element.
     */
    private function drawScatteredTriangles($img, $palette)
    {
        $a     = $palette['accent'];
        $count = mt_rand(10, 18);

        for ($i = 0; $i < $count; $i++) {
            $cx   = mt_rand(50, $this->width - 50);
            $cy   = mt_rand(20, $this->height - 20);
            $size = mt_rand(25, 80);
            $rot  = mt_rand(0, 360) * M_PI / 180;

            $isFilled = mt_rand(0, 2) === 0;
            $alpha    = $isFilled ? mt_rand(95, 110) : mt_rand(30, 60);
            $col      = imagecolorallocatealpha($img, $a[0], $a[1], $a[2], $alpha);
            $fillAlpha = mt_rand(110, 118);
            $fillCol  = imagecolorallocatealpha($img, $a[0], $a[1], $a[2], $fillAlpha);

            $points = [];
            for ($s = 0; $s < 3; $s++) {
                $angle    = $rot + ($s / 3) * 2 * M_PI - M_PI / 2;
                $points[] = (int)($cx + $size * cos($angle));
                $points[] = (int)($cy + $size * sin($angle));
            }

            if ($isFilled) {
                imagefilledpolygon($img, $points, 3, $fillCol);
            }
            imagesetthickness($img, 2);
            imagepolygon($img, $points, 3, $col);
            imagesetthickness($img, 1);
        }
    }

    /**
     * Subtle dot grid pattern for industrial texture.
     */
    private function drawDotGrid($img, $palette)
    {
        $a       = $palette['accent'];
        $spacing = mt_rand(35, 55);
        $alpha   = mt_rand(90, 105);
        $col     = imagecolorallocatealpha($img, $a[0], $a[1], $a[2], $alpha);

        for ($x = $spacing; $x < $this->width; $x += $spacing) {
            for ($y = $spacing; $y < $this->height; $y += $spacing) {
                imagefilledellipse($img, $x, $y, 3, 3, $col);
            }
        }
    }

    /**
     * Dark vignette effect on corners for depth/3D feel.
     */
    private function drawCornerVignette($img)
    {
        $cx = $this->width / 2;
        $cy = $this->height / 2;
        $maxDist = sqrt($cx * $cx + $cy * $cy);

        for ($y = 0; $y < $this->height; $y++) {
            for ($x = 0; $x < $this->width; $x++) {
                $dx   = $x - $cx;
                $dy   = $y - $cy;
                $dist = sqrt($dx * $dx + $dy * $dy);
                $ratio = $dist / $maxDist;

                if ($ratio > 0.5) {
                    $darkness = (int)(($ratio - 0.5) * 2 * 60);
                    $alpha = (int)(127 - $darkness);
                    if ($alpha < 80) $alpha = 80;
                    $col = imagecolorallocatealpha($img, 0, 0, 0, $alpha);
                    imagesetpixel($img, $x, $y, $col);
                }
            }
        }
    }

    /**
     * Warm accent glow from the left side — adds depth and directionality.
     */
    private function drawAccentGlow($img, $palette)
    {
        $g    = $palette['glow'];
        $cx   = (int)($this->width * 0.18);
        $cy   = (int)($this->height * 0.45);
        $maxR = 380;

        for ($r = $maxR; $r > 0; $r -= 3) {
            $ratio = $r / $maxR;
            $alpha = (int)(80 + 40 * $ratio);
            $col   = imagecolorallocatealpha($img, $g[0], $g[1], $g[2], min(127, $alpha));
            imagefilledellipse($img, $cx, $cy, $r * 2, (int)($r * 1.4), $col);
        }
    }

    /**
     * Fine metallic noise/grain for premium industrial texture.
     */
    private function addMetallicNoise($img)
    {
        for ($i = 0; $i < 6000; $i++) {
            $x = mt_rand(0, $this->width - 1);
            $y = mt_rand(0, $this->height - 1);
            $bright = mt_rand(0, 1) === 0 ? mt_rand(160, 220) : mt_rand(0, 20);
            $alpha  = mt_rand(110, 120);
            $col    = imagecolorallocatealpha($img, $bright, $bright, $bright, $alpha);
            imagesetpixel($img, $x, $y, $col);
        }
    }

    /**
     * Get color palette based on category and product name.
     * Each palette has: gradStart, gradEnd, accent, glow
     */
    private function getPalette($category, $productName)
    {
        $name = strtolower(trim($productName));
        $cat  = strtolower(trim($category));

        $palettes = [
            'hammer' => [
                'gradStart' => [45, 25, 10],
                'gradEnd'   => [20, 12, 8],
                'accent'    => [210, 160, 80],
                'glow'      => [180, 130, 60],
            ],
            'screwdriver' => [
                'gradStart' => [15, 25, 50],
                'gradEnd'   => [8, 12, 30],
                'accent'    => [100, 180, 255],
                'glow'      => [60, 130, 220],
            ],
            'drill' => [
                'gradStart' => [50, 30, 10],
                'gradEnd'   => [25, 15, 5],
                'accent'    => [255, 160, 40],
                'glow'      => [220, 140, 30],
            ],
            'saw' => [
                'gradStart' => [35, 30, 15],
                'gradEnd'   => [18, 15, 8],
                'accent'    => [200, 180, 100],
                'glow'      => [170, 150, 80],
            ],
            'wrench' => [
                'gradStart' => [25, 25, 30],
                'gradEnd'   => [12, 12, 18],
                'accent'    => [180, 190, 210],
                'glow'      => [140, 150, 180],
            ],
            'plier' => [
                'gradStart' => [30, 20, 25],
                'gradEnd'   => [15, 10, 15],
                'accent'    => [200, 140, 100],
                'glow'      => [180, 120, 80],
            ],
        ];

        $categoryPalettes = [
            'hand tools' => [
                'gradStart' => [30, 25, 20],
                'gradEnd'   => [15, 12, 10],
                'accent'    => [200, 170, 120],
                'glow'      => [160, 130, 90],
            ],
            'power tools' => [
                'gradStart' => [50, 25, 5],
                'gradEnd'   => [25, 12, 3],
                'accent'    => [255, 140, 40],
                'glow'      => [220, 120, 30],
            ],
            'electrical' => [
                'gradStart' => [10, 15, 45],
                'gradEnd'   => [5, 8, 25],
                'accent'    => [60, 140, 255],
                'glow'      => [40, 100, 220],
            ],
            'fasteners' => [
                'gradStart' => [30, 32, 35],
                'gradEnd'   => [15, 16, 18],
                'accent'    => [160, 170, 190],
                'glow'      => [120, 130, 160],
            ],
            'plumbing' => [
                'gradStart' => [10, 30, 35],
                'gradEnd'   => [5, 18, 22],
                'accent'    => [60, 180, 200],
                'glow'      => [40, 150, 170],
            ],
            'welding' => [
                'gradStart' => [40, 20, 5],
                'gradEnd'   => [15, 8, 2],
                'accent'    => [255, 180, 50],
                'glow'      => [255, 140, 30],
            ],
            'safety equipment' => [
                'gradStart' => [45, 40, 10],
                'gradEnd'   => [25, 22, 5],
                'accent'    => [255, 210, 40],
                'glow'      => [220, 180, 30],
            ],
            'measuring tools' => [
                'gradStart' => [15, 20, 40],
                'gradEnd'   => [8, 10, 25],
                'accent'    => [80, 160, 240],
                'glow'      => [60, 130, 200],
            ],
            'abrasives' => [
                'gradStart' => [45, 25, 15],
                'gradEnd'   => [25, 14, 8],
                'accent'    => [200, 120, 70],
                'glow'      => [170, 100, 60],
            ],
        ];

        $defaultPalette = [
            'gradStart' => [30, 30, 35],
            'gradEnd'   => [12, 12, 18],
            'accent'    => [140, 160, 200],
            'glow'      => [100, 120, 160],
        ];

        foreach ($palettes as $keyword => $palette) {
            if (strpos($name, $keyword) !== false) {
                return $palette;
            }
        }

        return isset($categoryPalettes[$cat]) ? $categoryPalettes[$cat] : $defaultPalette;
    }
}
