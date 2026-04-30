<?php

namespace App\Http\Controllers;

use App\Services\SupplierProducts\SupplierProductQueryService;
use App\Services\SupplierProducts\SupplierProductService;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierProductController extends Controller
{

    /**
     * Resolve supplier ID from authenticated user.
     */
    private function resolveSupplierID(Request $request): int
    {
        $user = $request->user();

        if ($user instanceof Supplier) {
            return $user->id;
        }

        $supplier = Supplier::where('email', $user->email)->first();
        if (!$supplier) {
            abort(403, 'No supplier account linked to this user.');
        }

        return $supplier->id;
    }

    /**
     * List supplier's products.
     */
    public function index(Request $request, SupplierProductQueryService $queryService)
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthorized. No authenticated user found.', 'status' => 'error'], 401);
        }

        $supplierId = $this->resolveSupplierID($request);

        $result = $queryService->supplierList(
            $supplierId,
            $request->get('search'),
            $request->get('category_id'),
            $request->get('per_page', 20)
        );

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Create supplier product.
     */
    public function store(Request $request, SupplierProductService $productService)
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthorized. No authenticated user found.', 'status' => 'error'], 401);
        }

        $supplierId = $this->resolveSupplierID($request);

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

        $result = $productService->create($supplierId, $data, $request);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Product created successfully', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Update supplier product.
     */
    public function update(Request $request, $id, SupplierProductService $productService)
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthorized. No authenticated user found.', 'status' => 'error'], 401);
        }

        $supplierId = $this->resolveSupplierID($request);

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

        $result = $productService->update($supplierId, $id, $data, $request);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Product updated successfully', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Delete supplier product.
     */
    public function destroy(Request $request, $id, SupplierProductService $productService)
    {
        $supplierId = $this->resolveSupplierID($request);

        $result = $productService->delete($supplierId, $id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['message' => 'Product deleted', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Admin list all supplier products.
     */
    public function adminIndex(Request $request, SupplierProductQueryService $queryService)
    {
        $result = $queryService->adminList(
            $request->get('search'),
            $request->get('category_id'),
            $request->get('supplier_id'),
            $request->get('promoted', false),
            $request->get('per_page', 20)
        );

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Admin show single supplier product.
     */
    public function adminShow($id, SupplierProductQueryService $queryService)
    {
        $result = $queryService->adminShow($id);

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }
}
