<?php

namespace App\Services\SupplierProducts;

use App\Models\SupplierProduct;
use App\Models\SupplierProductVariantAttribute;
use App\Jobs\ProcessSupplierProductImage;
use App\Events\DataMutated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SupplierProductService
{
    /**
     * Delete files from storage.
     */
    private function deleteFiles(array $paths): void
    {
        $clean = array_values(array_unique(array_filter($paths, function ($path) {
            return is_string($path) && trim($path) !== '';
        })));

        if (!empty($clean)) {
            Storage::disk('public')->delete($clean);
        }
    }

    /**
     * Create new supplier product.
     */
    public function create($supplierId, $data, $request)
    {
        $product = DB::transaction(function () use ($data, $request, $supplierId) {
            $imagePath = null;
            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store('supplier-products', 'public');
            }

            $additionalImages = [];
            if ($request->hasFile('additional_images')) {
                foreach ($request->file('additional_images') as $file) {
                    $additionalImages[] = $file->store('supplier-products', 'public');
                }
            }

            $product = SupplierProduct::create([
                'supplier_id' => $supplierId,
                'name' => $data['name'],
                'barcode' => $data['barcode'],
                'description' => $data['description'] ?? null,
                'category_id' => $data['category_id'] ?? null,
                'brand_id' => $data['brand_id'] ?? null,
                'price' => $data['price'],
                'min_order_qty' => $data['min_order_qty'] ?? 1,
                'total_stock' => $data['total_stock'] ?? 0,
                'base_size' => $data['base_size'] ?? null,
                'image_path' => $imagePath,
                'additional_images' => $additionalImages,
                'is_promoted' => $data['is_promoted'] ?? false,
                'status' => 'active',
            ]);

            if ($request->has('variants')) {
                $variants = json_decode($request->variants, true);
                if (is_array($variants)) {
                    foreach ($variants as $index => $v) {
                        $variantImage = null;
                        $fileKey = "variant_image_{$index}";
                        if ($request->hasFile($fileKey)) {
                            $request->validate([$fileKey => 'image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000']);
                            $variantImage = $request->file($fileKey)->store('supplier-product-variants', 'public');
                        }

                        $variantExtras = [];
                        $extraKey = "variant_extra_images_{$index}";
                        if ($request->hasFile($extraKey)) {
                            $request->validate([
                                $extraKey => 'array',
                                "{$extraKey}.*" => 'image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000'
                            ]);
                            foreach ($request->file($extraKey) as $file) {
                                $variantExtras[] = $file->store('supplier-product-variants', 'public');
                            }
                        }

                        if (isset($v['barcode']) && $v['barcode'] !== '') {
                            $existingBarcode = \App\Models\SupplierProductVariant::where('barcode', $v['barcode'])->first();
                            if ($existingBarcode) {
                                throw ValidationException::withMessages(['variants' => ['Variant barcode already in use: ' . $v['barcode']]]);
                            }
                        }

                        $savedVariant = $product->variants()->create([
                            'size' => $v['size'] ?? null,
                            'color' => $v['color'] ?? null,
                            'weight' => $v['weight'] ?? null,
                            'stock' => $v['stock'] ?? 0,
                            'price_override' => isset($v['price_override']) && $v['price_override'] !== '' ? $v['price_override'] : null,
                            'barcode_suffix' => $v['barcode_suffix'] ?? null,
                            'barcode' => isset($v['barcode']) && $v['barcode'] !== '' ? $v['barcode'] : null,
                            'image_path' => $variantImage,
                            'additional_images' => $variantExtras,
                        ]);

                        if (!empty($savedVariant) && is_array($v['attributes'] ?? null)) {
                            SupplierProductVariantAttribute::where('supplier_product_variant_id', $savedVariant->id)->delete();
                            foreach ($v['attributes'] as $attr) {
                                if (empty($attr['variant_id']) || empty($attr['variant_value_id'])) continue;
                                SupplierProductVariantAttribute::create([
                                    'supplier_product_variant_id' => $savedVariant->id,
                                    'variant_id' => (int) $attr['variant_id'],
                                    'variant_value_id' => (int) $attr['variant_value_id'],
                                ]);
                            }
                        }

                        if (!empty($savedVariant) && !empty($savedVariant->barcode)) {
                            $linkedProductVariantIds = DB::table('inventory')
                                ->where('supplier_product_variant_id', $savedVariant->id)
                                ->whereNotNull('product_variant_id')
                                ->pluck('product_variant_id')
                                ->unique()
                                ->all();

                            if (!empty($linkedProductVariantIds)) {
                                DB::table('product_variants')
                                    ->whereIn('id', $linkedProductVariantIds)
                                    ->update(['barcode' => $savedVariant->barcode]);
                            }
                        }
                    }
                }
            }

            return $product;
        });

        broadcast(new DataMutated('private-admin', ['admin_inventory', 'admin_purchases'], 'supplier_product.created'));
        broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_products', 'supplier_dashboard'], 'supplier_product.created'));

        if ($product->image_path || !empty($product->additional_images)) {
            ProcessSupplierProductImage::dispatchSync($product->id);
        }

        return [
            'data' => $product->load(['category', 'variants.attributes.variant', 'variants.attributes.variantValue']),
            'status_code' => 201,
        ];
    }

    /**
     * Update supplier product.
     */
    public function update($supplierId, $productId, $data, $request)
    {
        $product = SupplierProduct::where('supplier_id', $supplierId)->findOrFail($productId);

        DB::transaction(function () use ($product, $data, $request) {
            $oldImage = $product->image_path;
            $oldAdditional = $product->additional_images ?? [];

            if ($request->hasFile('image')) {
                $data['image_path'] = $request->file('image')->store('supplier-products', 'public');
                $this->deleteFiles([$oldImage]);
            }

            $additionalImages = [];
            if ($request->has('existing_additional_images')) {
                $additionalImages = json_decode($request->existing_additional_images, true) ?: [];
            }
            if ($request->hasFile('additional_images')) {
                foreach ($request->file('additional_images') as $file) {
                    $additionalImages[] = $file->store('supplier-products', 'public');
                }
            }
            $this->deleteFiles(array_diff($oldAdditional, $additionalImages));
            $data['additional_images'] = $additionalImages;

            $product->update($data);

            if ($request->has('variants')) {
                $variantsRaw = $request->variants;
                $variants = json_decode($variantsRaw, true);
                if (!is_array($variants) && !is_null($variantsRaw) && trim((string) $variantsRaw) !== '') {
                    throw ValidationException::withMessages(['variants' => ['Invalid variants JSON.']]);
                }
                $variants = is_array($variants) ? $variants : [];

                $incomingVariantIds = [];

                foreach ($variants as $index => $v) {
                    $variantId = $v['id'] ?? null;
                    $existingVariant = null;
                    if (!empty($variantId)) {
                        $existingVariant = $product->variants()->whereKey($variantId)->first();
                    }

                    $fileKey = "variant_image_{$index}";
                    $newImagePath = null;
                    $variantImage = null;
                    if ($request->hasFile($fileKey)) {
                        $request->validate([$fileKey => 'image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000']);
                        $newImagePath = $request->file($fileKey)->store('supplier-product-variants', 'public');
                        $variantImage = $newImagePath;
                    } elseif (!empty($v['existing_image_path'])) {
                        $variantImage = $v['existing_image_path'];
                    } elseif ($existingVariant) {
                        $variantImage = $existingVariant->image_path;
                    }

                    $variantExtras = [];
                    if (isset($v['existing_extra_images']) && is_array($v['existing_extra_images'])) {
                        $variantExtras = $v['existing_extra_images'];
                    } elseif ($existingVariant && is_array($existingVariant->additional_images)) {
                        $variantExtras = $existingVariant->additional_images;
                    }

                    $extraKey = "variant_extra_images_{$index}";
                    if ($request->hasFile($extraKey)) {
                        $request->validate([
                            $extraKey => 'array',
                            "{$extraKey}.*" => 'image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000'
                        ]);
                        foreach ($request->file($extraKey) as $file) {
                            $variantExtras[] = $file->store('supplier-product-variants', 'public');
                        }
                    }

                    if (isset($v['barcode']) && $v['barcode'] !== '') {
                        $existingBarcode = \App\Models\SupplierProductVariant::where('barcode', $v['barcode'])
                            ->where('id', '!=', $variantId)
                            ->first();
                        if ($existingBarcode) {
                            throw ValidationException::withMessages(['variants' => ['Variant barcode already in use: ' . $v['barcode']]]);
                        }
                    }

                    $payload = [
                        'supplier_product_id' => $product->id,
                        'size' => $v['size'] ?? null,
                        'color' => $v['color'] ?? null,
                        'weight' => $v['weight'] ?? null,
                        'stock' => $v['stock'] ?? 0,
                        'price_override' => isset($v['price_override']) && $v['price_override'] !== '' ? $v['price_override'] : null,
                        'barcode_suffix' => $v['barcode_suffix'] ?? null,
                        'barcode' => isset($v['barcode']) && $v['barcode'] !== '' ? $v['barcode'] : null,
                        'image_path' => $variantImage,
                        'additional_images' => $variantExtras,
                    ];

                    if ($existingVariant) {
                        $oldImage = $existingVariant->image_path;
                        $oldExtras = $existingVariant->additional_images ?? [];

                        $existingVariant->update($payload);
                        $incomingVariantIds[] = $existingVariant->id;

                        if (!empty($existingVariant) && is_array($v['attributes'] ?? null)) {
                            SupplierProductVariantAttribute::where('supplier_product_variant_id', $existingVariant->id)->delete();
                            foreach ($v['attributes'] as $attr) {
                                if (empty($attr['variant_id']) || empty($attr['variant_value_id'])) continue;
                                SupplierProductVariantAttribute::create([
                                    'supplier_product_variant_id' => $existingVariant->id,
                                    'variant_id' => (int) $attr['variant_id'],
                                    'variant_value_id' => (int) $attr['variant_value_id'],
                                ]);
                            }
                        }

                        if (!empty($existingVariant) && !empty($existingVariant->barcode)) {
                            $linkedProductVariantIds = DB::table('inventory')
                                ->where('supplier_product_variant_id', $existingVariant->id)
                                ->whereNotNull('product_variant_id')
                                ->pluck('product_variant_id')
                                ->unique()
                                ->all();

                            if (!empty($linkedProductVariantIds)) {
                                DB::table('product_variants')
                                    ->whereIn('id', $linkedProductVariantIds)
                                    ->update(['barcode' => $existingVariant->barcode]);
                            }
                        }

                        if ($newImagePath && $oldImage && $oldImage !== $newImagePath) {
                            $this->deleteFiles([$oldImage]);
                        }

                        if (isset($v['existing_extra_images']) && is_array($v['existing_extra_images'])) {
                            $removedExtras = array_diff($oldExtras, $variantExtras);
                            $this->deleteFiles($removedExtras);
                        }
                    } else {
                        $savedVariant = $product->variants()->create($payload);
                        $incomingVariantIds[] = $savedVariant->id;

                        if (!empty($savedVariant) && is_array($v['attributes'] ?? null)) {
                            SupplierProductVariantAttribute::where('supplier_product_variant_id', $savedVariant->id)->delete();
                            foreach ($v['attributes'] as $attr) {
                                if (empty($attr['variant_id']) || empty($attr['variant_value_id'])) continue;
                                SupplierProductVariantAttribute::create([
                                    'supplier_product_variant_id' => $savedVariant->id,
                                    'variant_id' => (int) $attr['variant_id'],
                                    'variant_value_id' => (int) $attr['variant_value_id'],
                                ]);
                            }
                        }

                        if (!empty($savedVariant) && !empty($savedVariant->barcode)) {
                            $linkedProductVariantIds = DB::table('inventory')
                                ->where('supplier_product_variant_id', $savedVariant->id)
                                ->whereNotNull('product_variant_id')
                                ->pluck('product_variant_id')
                                ->unique()
                                ->all();

                            if (!empty($linkedProductVariantIds)) {
                                DB::table('product_variants')
                                    ->whereIn('id', $linkedProductVariantIds)
                                    ->update(['barcode' => $savedVariant->barcode]);
                            }
                        }
                    }
                }

                $removedVariants = $product->variants()
                    ->when(!empty($incomingVariantIds), fn($q) => $q->whereNotIn('id', $incomingVariantIds))
                    ->when(empty($incomingVariantIds), fn($q) => $q)
                    ->get();

                $removedPaths = [];
                foreach ($removedVariants as $rv) {
                    $removedPaths[] = $rv->image_path;
                    $removedPaths = array_merge($removedPaths, $rv->additional_images ?? []);
                }

                if ($removedVariants->count() > 0) {
                    $product->variants()->whereIn('id', $removedVariants->pluck('id'))->delete();
                    $this->deleteFiles($removedPaths);
                }
            }
        });

        broadcast(new DataMutated('private-admin', ['admin_inventory', 'admin_purchases'], 'supplier_product.updated'));
        broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_products', 'supplier_dashboard'], 'supplier_product.updated'));

        if ($request->hasFile('image') || $request->hasFile('additional_images')) {
            ProcessSupplierProductImage::dispatchSync($product->id);
        }

        return [
            'data' => $product->load(['category', 'variants.attributes.variant', 'variants.attributes.variantValue']),
            'status_code' => 200,
        ];
    }

    /**
     * Delete supplier product.
     */
    public function delete($supplierId, $productId)
    {
        $product = SupplierProduct::where('supplier_id', $supplierId)->findOrFail($productId);

        $pathsToDelete = [$product->image_path];
        $pathsToDelete = array_merge($pathsToDelete, $product->additional_images ?? []);
        $variants = $product->variants()->get();
        foreach ($variants as $variant) {
            $pathsToDelete[] = $variant->image_path;
            $pathsToDelete = array_merge($pathsToDelete, $variant->additional_images ?? []);
        }
        $this->deleteFiles($pathsToDelete);

        $product->delete();

        broadcast(new DataMutated('private-admin', ['admin_inventory', 'admin_purchases'], 'supplier_product.deleted'));
        broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_products', 'supplier_dashboard'], 'supplier_product.deleted'));

        return [
            'status_code' => 200,
        ];
    }
}
