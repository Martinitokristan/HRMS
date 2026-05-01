<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class BrandController extends Controller
{
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

    /**
     * Supplier brand index — supports ?category_id=X to filter by category.
     * Brands not attached to any category are always visible (legacy / uncategorised brands).
     */
    public function index(Request $request)
    {
        $supplierId = $this->resolveSupplierID($request);

        $query = Brand::with('categories')
            ->where('supplier_id', $supplierId)
            ->orderBy('name');

        if ($request->filled('category_id')) {
            $cid = (int) $request->category_id;
            $query->where(function ($q) use ($cid) {
                // brands tagged to this category
                $q->whereHas('categories', fn ($qq) => $qq->where('categories.id', $cid))
                  // OR brands with no category tags at all (legacy brands stay visible)
                  ->orWhereDoesntHave('categories');
            });
        }

        $brands = $query->get();

        return response()->json(['data' => $brands->toArray(), 'status' => 'success']);
    }

    public function store(Request $request)
    {
        $supplierId = $this->resolveSupplierID($request);

        $data = $request->validate([
            'name'          => 'required|string|max:100',
            'description'   => 'nullable|string',
            'category_ids'  => 'nullable|array',
            'category_ids.*'=> 'integer|exists:categories,id',
        ]);

        $brand = Brand::create([
            'supplier_id' => $supplierId,
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
        ]);

        if (!empty($data['category_ids'])) {
            $brand->categories()->sync($data['category_ids']);
        }

        \App\Support\ProductCache::bust();

        return response()->json(['data' => $brand->load('categories'), 'status' => 'success'], 201);
    }

    public function update(Request $request, $id)
    {
        $supplierId = $this->resolveSupplierID($request);

        $brand = Brand::where('id', $id)->where('supplier_id', $supplierId)->first();
        if (!$brand) {
            return response()->json(['message' => 'Brand not found or access denied.', 'status' => 'error'], 404);
        }

        $data = $request->validate([
            'name'          => 'sometimes|required|string|max:100',
            'description'   => 'nullable|string',
            'category_ids'  => 'nullable|array',
            'category_ids.*'=> 'integer|exists:categories,id',
        ]);

        $brand->update([
            'name'        => $data['name']        ?? $brand->name,
            'description' => array_key_exists('description', $data) ? $data['description'] : $brand->description,
        ]);

        if (array_key_exists('category_ids', $data)) {
            $brand->categories()->sync($data['category_ids'] ?? []);
        }

        \App\Support\ProductCache::bust();

        return response()->json(['data' => $brand->load('categories'), 'status' => 'success']);
    }

    public function destroy(Request $request, $id)
    {
        $supplierId = $this->resolveSupplierID($request);

        $brand = Brand::where('id', $id)->where('supplier_id', $supplierId)->first();

        if (!$brand) {
            return response()->json(['message' => 'Brand not found or access denied.', 'status' => 'error'], 404);
        }

        $brand->delete();

        \App\Support\ProductCache::bust();

        return response()->json(['message' => 'Brand deleted.', 'status' => 'success']);
    }

    public function adminIndex(Request $request)
    {
        $query = Brand::with(['supplier', 'categories'])->orderBy('name');

        if ($request->filled('category_id')) {
            $cid = (int) $request->category_id;
            $query->where(function ($q) use ($cid) {
                $q->whereHas('categories', fn ($qq) => $qq->where('categories.id', $cid))
                  ->orWhereDoesntHave('categories');
            });
        }

        $brands = $query->get();

        return response()->json(['data' => $brands->toArray(), 'status' => 'success']);
    }
}
