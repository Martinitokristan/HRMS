<?php

namespace App\Services\SupplierProducts;

use App\Models\SupplierProduct;

class SupplierProductQueryService
{
    /**
     * Get supplier's products.
     */
    public function supplierList($supplierId, $search = null, $categoryId = null, $perPage = 20)
    {
        $query = SupplierProduct::with(['category', 'variants.attributes.variant', 'variants.attributes.variantValue', 'brand'])
            ->where('supplier_id', $supplierId)
            ->when($search, function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            })
            ->when($categoryId, function ($q) use ($categoryId) {
                $q->where('category_id', $categoryId);
            })
            ->orderBy('created_at', 'desc');

        return [
            'data' => $query->paginate($perPage),
            'status_code' => 200,
        ];
    }

    /**
     * Get all supplier products (admin view).
     */
    public function adminList($search = null, $categoryId = null, $supplierId = null, $promoted = false, $perPage = 20)
    {
        $query = SupplierProduct::with(['supplier', 'category', 'variants', 'brand'])
            ->where('status', 'active')
            ->when($search, function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            })
            ->when($categoryId, function ($q) use ($categoryId) {
                $q->where('category_id', $categoryId);
            })
            ->when($supplierId, function ($q) use ($supplierId) {
                $q->where('supplier_id', $supplierId);
            })
            ->when($promoted, function ($q) {
                $q->where('is_promoted', true);
            })
            ->orderByDesc('is_promoted')
            ->orderByDesc('created_at');

        return [
            'data' => $query->paginate($perPage),
            'status_code' => 200,
        ];
    }

    /**
     * Get single supplier product (admin view).
     */
    public function adminShow($id)
    {
        $product = SupplierProduct::with(['supplier', 'category', 'variants', 'brand'])->findOrFail($id);

        return [
            'data' => $product,
            'status_code' => 200,
        ];
    }
}
