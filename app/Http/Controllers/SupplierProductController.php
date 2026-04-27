<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Jobs\ProcessSupplierProductImage;
use App\Models\SupplierProduct;
use App\Models\SupplierProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SupplierProductController extends Controller
{
    /**
     * Resolve the suppliers.id for the currently authenticated user.
     * Supplier users log in via the shared /api/login endpoint (users table),
     * but supplier_products.supplier_id references suppliers.id.
     * The two tables are linked by email.
     */
    private function resolveSupplierID(Request $request): int
    {
        $user = $request->user();
        if ($user instanceof \App\Models\Supplier) {
            return $user->id;
        }
        $supplier = \App\Models\Supplier::where('email', $user->email)->first();
        if (!$supplier) {
            abort(403, 'No supplier account linked to this user.');
        }
        return $supplier->id;
    }

    private function deleteFiles(array $paths): void
    {
        $clean = array_values(array_unique(array_filter($paths, function ($path) {
            return is_string($path) && trim($path) !== '';
        })));

        if (!empty($clean)) {
            Storage::disk('public')->delete($clean);
        }
    }

    // Supplier-facing: list their own products
    public function index(Request $request)
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthorized. No authenticated user found.', 'status' => 'error'], 401);
        }

        $supplierId = $this->resolveSupplierID($request);

        $query = SupplierProduct::with(['category', 'variants', 'brand'])
            ->where('supplier_id', $supplierId)
            ->when($request->search, function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('barcode', 'like', "%{$request->search}%");
            })
            ->when($request->category_id, function ($q) use ($request) {
                $q->where('category_id', $request->category_id);
            })
            ->orderBy('created_at', 'desc');

        $products = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => $products,
            'status' => 'success',
        ]);
    }

    // Supplier-facing: create a product
    public function store(Request $request)
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthorized. No authenticated user found.', 'status' => 'error'], 401);
        }

        $supplierId = $this->resolveSupplierID($request);
        $supplier = $request->user();

        $data = $request->validate([
            'name' => 'required|string|max:150',
            'barcode' => 'required|string|max:50|unique:supplier_products',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'price' => 'required|numeric|min:0',
            'min_order_qty' => 'nullable|integer|min:1',
            'total_stock' => 'nullable|integer|min:0',
            'base_size' => 'nullable|string|max:50',
            'is_promoted' => 'nullable|boolean',
            'variants' => 'nullable|string',
            'brand_id' => 'nullable|exists:brands,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000',
            'additional_images' => 'nullable|array',
            'additional_images.*' => 'image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000',
        ]);

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

                        // Validate barcode uniqueness at application layer
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

                        // Propagate the supplier-set barcode to any linked admin product_variants rows.
                        // Linkage is via the inventory table: inventory.supplier_product_variant_id <-> inventory.product_variant_id.
                        if (!empty($savedVariant) && !empty($savedVariant->barcode)) {
                            $linkedProductVariantIds = \DB::table('inventory')
                                ->where('supplier_product_variant_id', $savedVariant->id)
                                ->whereNotNull('product_variant_id')
                                ->pluck('product_variant_id')
                                ->unique()
                                ->all();

                            if (!empty($linkedProductVariantIds)) {
                                \DB::table('product_variants')
                                    ->whereIn('id', $linkedProductVariantIds)
                                    ->update(['barcode' => $savedVariant->barcode]);
                            }
                        }
                    }
                }
            }

            return $product;
        });

        $supplierId = $product->supplier_id;
        broadcast(new DataMutated('private-admin', ['admin_inventory', 'admin_purchases'], 'supplier_product.created'));
        broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_products', 'supplier_dashboard'], 'supplier_product.created'));

        if ($product->image_path || !empty($product->additional_images)) {
            ProcessSupplierProductImage::dispatchSync($product->id);
        }

        return response()->json([
            'data' => $product->load(['category', 'variants']),
            'message' => 'Product created successfully',
            'status' => 'success',
        ], 201);
    }

    // Supplier-facing: update a product
    public function update(Request $request, $id)
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthorized. No authenticated user found.', 'status' => 'error'], 401);
        }

        $supplierId = $this->resolveSupplierID($request);
        $product = SupplierProduct::where('supplier_id', $supplierId)->findOrFail($id);

        $data = $request->validate([
            'name' => 'required|string|max:150',
            'barcode' => 'required|string|max:50|unique:supplier_products,barcode,' . $id,
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'price' => 'required|numeric|min:0',
            'min_order_qty' => 'nullable|integer|min:1',
            'total_stock' => 'nullable|integer|min:0',
            'base_size' => 'nullable|string|max:50',
            'is_promoted' => 'nullable|boolean',
            'variants' => 'nullable|string',
            'brand_id' => 'nullable|exists:brands,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000',
            'additional_images' => 'nullable|array',
            'additional_images.*' => 'image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000',
        ]);

        DB::transaction(function () use ($product, $data, $request) {
            $oldImage = $product->image_path;
            $oldAdditional = $product->additional_images ?? [];

            if ($request->hasFile('image')) {
                $data['image_path'] = $request->file('image')->store('supplier-products', 'public');
                $this->deleteFiles([$oldImage]);
            }

            // Handle base product additional images
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
                    throw ValidationException::withMessages([
                        'variants' => ['Invalid variants JSON.'],
                    ]);
                }
                $variants = is_array($variants) ? $variants : [];

                $incomingVariantIds = [];

                foreach ($variants as $index => $v) {
                    $variantId = $v['id'] ?? null;

                    $existingVariant = null;
                    if (!empty($variantId)) {
                        $existingVariant = $product->variants()->whereKey($variantId)->first();
                    }

                    // Image: prefer uploaded file, else keep existing payload, else keep DB value (when updating).
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

                    // Extra images: start from payload (or DB when updating), then append uploads.
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

                    // Validate barcode uniqueness at application layer (allow same row to keep its own value)
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

                        // Propagate the supplier-set barcode to any linked admin product_variants rows.
                        // Linkage is via the inventory table: inventory.supplier_product_variant_id <-> inventory.product_variant_id.
                        if (!empty($existingVariant) && !empty($existingVariant->barcode)) {
                            $linkedProductVariantIds = \DB::table('inventory')
                                ->where('supplier_product_variant_id', $existingVariant->id)
                                ->whereNotNull('product_variant_id')
                                ->pluck('product_variant_id')
                                ->unique()
                                ->all();

                            if (!empty($linkedProductVariantIds)) {
                                \DB::table('product_variants')
                                    ->whereIn('id', $linkedProductVariantIds)
                                    ->update(['barcode' => $existingVariant->barcode]);
                            }
                        }

                        // Delete replaced image only.
                        if ($newImagePath && $oldImage && $oldImage !== $newImagePath) {
                            $this->deleteFiles([$oldImage]);
                        }

                        // Delete removed extras (only if client provided a keep-list).
                        if (isset($v['existing_extra_images']) && is_array($v['existing_extra_images'])) {
                            $removedExtras = array_diff($oldExtras, $variantExtras);
                            $this->deleteFiles($removedExtras);
                        }
                    } else {
                        $savedVariant = $product->variants()->create($payload);
                        $incomingVariantIds[] = $savedVariant->id;

                        // Propagate the supplier-set barcode to any linked admin product_variants rows.
                        // Linkage is via the inventory table: inventory.supplier_product_variant_id <-> inventory.product_variant_id.
                        if (!empty($savedVariant) && !empty($savedVariant->barcode)) {
                            $linkedProductVariantIds = \DB::table('inventory')
                                ->where('supplier_product_variant_id', $savedVariant->id)
                                ->whereNotNull('product_variant_id')
                                ->pluck('product_variant_id')
                                ->unique()
                                ->all();

                            if (!empty($linkedProductVariantIds)) {
                                \DB::table('product_variants')
                                    ->whereIn('id', $linkedProductVariantIds)
                                    ->update(['barcode' => $savedVariant->barcode]);
                            }
                        }
                    }
                }

                // Delete only variants that were removed from the incoming list.
                $removedVariants = $product->variants()
                    ->when(!empty($incomingVariantIds), fn($q) => $q->whereNotIn('id', $incomingVariantIds))
                    ->when(empty($incomingVariantIds), fn($q) => $q) // delete all if caller sent empty list
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

        $supplierId = $product->supplier_id;
        broadcast(new DataMutated('private-admin', ['admin_inventory', 'admin_purchases'], 'supplier_product.updated'));
        broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_products', 'supplier_dashboard'], 'supplier_product.updated'));

        if ($request->hasFile('image') || $request->hasFile('additional_images')) {
            ProcessSupplierProductImage::dispatchSync($product->id);
        }

        return response()->json([
            'data' => $product->load(['category', 'variants']),
            'message' => 'Product updated successfully',
            'status' => 'success',
        ]);
    }

    // Supplier-facing: delete a product
    public function destroy(Request $request, $id)
    {
        $supplierId = $this->resolveSupplierID($request);
        $product = SupplierProduct::where('supplier_id', $supplierId)->findOrFail($id);

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

        return response()->json([
            'message' => 'Product deleted',
            'status' => 'success',
        ]);
    }

    // Admin-facing: list all supplier products (catalog view)
    public function adminIndex(Request $request)
    {
        $query = SupplierProduct::with(['supplier', 'category', 'variants', 'brand'])
            ->where('status', 'active')
            ->when($request->search, function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('barcode', 'like', "%{$request->search}%");
            })
            ->when($request->category_id, function ($q) use ($request) {
                $q->where('category_id', $request->category_id);
            })
            ->when($request->supplier_id, function ($q) use ($request) {
                $q->where('supplier_id', $request->supplier_id);
            })
            ->when($request->promoted, function ($q) {
                $q->where('is_promoted', true);
            })
            ->orderByDesc('is_promoted')
            ->orderByDesc('created_at');

        $products = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => $products,
            'status' => 'success',
        ]);
    }

    // Admin-facing: show a single supplier product
    public function adminShow($id)
    {
        $product = SupplierProduct::with(['supplier', 'category', 'variants', 'brand'])->findOrFail($id);

        return response()->json([
            'data' => $product,
            'status' => 'success',
        ]);
    }
}
