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

    public function index(Request $request)
    {
        $supplierId = $this->resolveSupplierID($request);
        $brands = Brand::where('supplier_id', $supplierId)->orderBy('name')->get();

        return response()->json(['data' => $brands, 'status' => 'success']);
    }

    public function store(Request $request)
    {
        $supplierId = $this->resolveSupplierID($request);

        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string',
        ]);

        $brand = Brand::create([
            'supplier_id' => $supplierId,
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
        ]);

        Cache::tags(['products'])->flush();

        return response()->json(['data' => $brand, 'status' => 'success'], 201);
    }

    public function destroy(Request $request, $id)
    {
        $supplierId = $this->resolveSupplierID($request);

        $brand = Brand::where('id', $id)->where('supplier_id', $supplierId)->first();

        if (!$brand) {
            return response()->json(['message' => 'Brand not found or access denied.', 'status' => 'error'], 404);
        }

        $brand->delete();

        Cache::tags(['products'])->flush();

        return response()->json(['message' => 'Brand deleted.', 'status' => 'success']);
    }

    public function adminIndex(Request $request)
    {
        $brands = Brand::with('supplier')->orderBy('name')->get();

        return response()->json(['data' => $brands, 'status' => 'success']);
    }
}
