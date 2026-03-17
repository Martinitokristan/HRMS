<?php

namespace App\Http\Controllers;

use App\Models\SupplierProduct;
use App\Models\SupplierProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupplierProductController extends Controller
{
    // Supplier-facing: list their own products
    public function index(Request $request)
    {
        $supplier = $request->user();

        $query = SupplierProduct::with(['category', 'variants'])
            ->where('supplier_id', $supplier->id)
            ->when($request->search, function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('sku', 'like', "%{$request->search}%");
            })
            ->when($request->category_id, function ($q) use ($request) {
                $q->where('category_id', $request->category_id);
            })
            ->orderBy('created_at', 'desc');

        $products = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'data' => $products,
            'status' => 'success',
        ]);
    }

    // Supplier-facing: create a product
    public function store(Request $request)
    {
        $supplier = $request->user();

        $data = $request->validate([
            'name'           => 'required|string|max:150',
            'sku'            => 'nullable|string|max:50',
            'description'    => 'nullable|string',
            'category_id'    => 'nullable|exists:categories,id',
            'price'          => 'required|numeric|min:0',
            'min_order_qty'  => 'nullable|integer|min:1',
            'is_promoted'    => 'nullable|boolean',
            'variants'       => 'nullable|string',
        ]);

        $product = DB::transaction(function () use ($data, $request, $supplier) {
            $imagePath = null;
            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store('supplier-products', 'public');
            }

            $product = SupplierProduct::create([
                'supplier_id'   => $supplier->id,
                'name'          => $data['name'],
                'sku'           => $data['sku'] ?? null,
                'description'   => $data['description'] ?? null,
                'category_id'   => $data['category_id'] ?? null,
                'price'         => $data['price'],
                'min_order_qty' => $data['min_order_qty'] ?? 1,
                'image_path'    => $imagePath,
                'is_promoted'   => $data['is_promoted'] ?? false,
                'status'        => 'active',
            ]);

            if ($request->has('variants')) {
                $variants = json_decode($request->variants, true);
                if (is_array($variants)) {
                    foreach ($variants as $index => $v) {
                        $variantImage = null;
                        $fileKey = "variant_image_{$index}";
                        if ($request->hasFile($fileKey)) {
                            $variantImage = $request->file($fileKey)->store('supplier-product-variants', 'public');
                        }
                        $product->variants()->create([
                            'size'           => $v['size'] ?? null,
                            'color'          => $v['color'] ?? null,
                            'weight'         => $v['weight'] ?? null,
                            'stock'          => $v['stock'] ?? 0,
                            'price_override' => isset($v['price_override']) && $v['price_override'] !== '' ? $v['price_override'] : null,
                            'sku_suffix'     => $v['sku_suffix'] ?? null,
                            'image_path'     => $variantImage,
                        ]);
                    }
                }
            }

            return $product;
        });

        return response()->json([
            'data'    => $product->load(['category', 'variants']),
            'message' => 'Product created successfully',
            'status'  => 'success',
        ], 201);
    }

    // Supplier-facing: update a product
    public function update(Request $request, $id)
    {
        $supplier = $request->user();
        $product = SupplierProduct::where('supplier_id', $supplier->id)->findOrFail($id);

        $data = $request->validate([
            'name'           => 'required|string|max:150',
            'sku'            => 'nullable|string|max:50',
            'description'    => 'nullable|string',
            'category_id'    => 'nullable|exists:categories,id',
            'price'          => 'required|numeric|min:0',
            'min_order_qty'  => 'nullable|integer|min:1',
            'is_promoted'    => 'nullable|boolean',
            'variants'       => 'nullable|string',
        ]);

        DB::transaction(function () use ($product, $data, $request) {
            if ($request->hasFile('image')) {
                $data['image_path'] = $request->file('image')->store('supplier-products', 'public');
            }

            $product->update($data);

            if ($request->has('variants')) {
                $product->variants()->delete();
                $variants = json_decode($request->variants, true);
                if (is_array($variants)) {
                    foreach ($variants as $index => $v) {
                        $variantImage = null;
                        $fileKey = "variant_image_{$index}";
                        if ($request->hasFile($fileKey)) {
                            $variantImage = $request->file($fileKey)->store('supplier-product-variants', 'public');
                        } elseif (!empty($v['existing_image_path'])) {
                            $variantImage = $v['existing_image_path'];
                        }
                        $product->variants()->create([
                            'size'           => $v['size'] ?? null,
                            'color'          => $v['color'] ?? null,
                            'weight'         => $v['weight'] ?? null,
                            'stock'          => $v['stock'] ?? 0,
                            'price_override' => isset($v['price_override']) && $v['price_override'] !== '' ? $v['price_override'] : null,
                            'sku_suffix'     => $v['sku_suffix'] ?? null,
                            'image_path'     => $variantImage,
                        ]);
                    }
                }
            }
        });

        return response()->json([
            'data'    => $product->load(['category', 'variants']),
            'message' => 'Product updated successfully',
            'status'  => 'success',
        ]);
    }

    // Supplier-facing: delete a product
    public function destroy(Request $request, $id)
    {
        $supplier = $request->user();
        $product = SupplierProduct::where('supplier_id', $supplier->id)->findOrFail($id);
        $product->delete();

        return response()->json([
            'message' => 'Product deleted',
            'status'  => 'success',
        ]);
    }

    // Admin-facing: list all supplier products (catalog view)
    public function adminIndex(Request $request)
    {
        $query = SupplierProduct::with(['supplier', 'category', 'variants'])
            ->where('status', 'active')
            ->when($request->search, function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('sku', 'like', "%{$request->search}%");
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
        $product = SupplierProduct::with(['supplier', 'category', 'variants'])->findOrFail($id);

        return response()->json([
            'data' => $product,
            'status' => 'success',
        ]);
    }
}
