<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use Illuminate\Http\Request;
use App\Services\Inventory\InventoryQueryService;
use App\Services\Inventory\InventoryAdjustmentService;
use App\Services\Inventory\InventoryReorderService;
use App\Services\Inventory\InventoryTransferService;

class InventoryController extends Controller
{
    public function index(Request $request, InventoryQueryService $queryService)
    {
        $cached = $queryService->getList($request);

        return response()->json($cached);
    }

    public function adjust(Request $request, InventoryAdjustmentService $adjustmentService)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'type' => 'required|in:add,subtract,set',
            'quantity' => 'required|numeric|min:0',
            'reason' => 'nullable|string',
        ]);

        $result = $adjustmentService->adjust($data, $request->user());

        return response()->json([
            'message' => $result['message'],
            'status'  => 'success',
        ]);
    }

    public function reorder(Request $request, $id, InventoryReorderService $reorderService)
    {
        $result = $reorderService->reorder($id, $request->user());

        if (isset($result['error'])) {
            return response()->json([
                'message' => $result['error'],
                'status' => 'error',
            ], $result['status_code']);
        }

        return response()->json([
            'data' => $result['po'],
            'message' => 'Reorder PO created successfully',
            'status' => 'success',
        ], 201);
    }

    public function transferToStore(Request $request, InventoryTransferService $transferService)
    {
        $data = $request->validate([
            'inventory_id' => 'nullable',
            'product_id' => 'nullable|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'quantity' => 'required|numeric|min:1',
            'product_data' => 'nullable|array',
            'product_data.name' => 'nullable|string',
            'product_data.barcode' => 'nullable|string',
            'product_data.category_id' => 'nullable|integer',
            'product_data.unit_type_id' => 'nullable|integer',
            'product_data.sell_price' => 'nullable|numeric',
            'product_data.description' => 'nullable|string',
            'product_data.purchase_price' => 'nullable|numeric',
        ]);

        $result = $transferService->transferToStore($data, $request->user());

        if (isset($result['error'])) {
            return response()->json([
                'message' => $result['error'],
                'status' => 'error',
            ], $result['status_code']);
        }

        return response()->json([
            'data' => $result['result'],
            'message' => 'Stock transferred to storefront successfully. ' . ($result['result']->product ? 'Product is now in store module.' : ''),
            'status' => 'success',
        ]);
    }

    public function transferMultipleToStore(Request $request, InventoryTransferService $transferService)
    {
        $data = $request->validate([
            'transfers' => 'required|array|min:1',
            'transfers.*.inventory_id' => 'required|string',
            'transfers.*.quantity' => 'required|numeric|min:1',
            'transfers.*.product_data' => 'nullable|array',
            'transfers.*.product_data.sell_price' => 'nullable|numeric|min:0',
            'base_product_data' => 'nullable|array',
        ]);

        $result = $transferService->transferMultipleToStore($data, $request->user());

        if (isset($result['error'])) {
            return response()->json([
                'message' => $result['error'],
                'status' => 'error',
            ], $result['status_code']);
        }

        return response()->json([
            'data' => $result['results'],
            'message' => "{$result['results']['count']} variant(s) transferred to storefront successfully.",
            'status' => 'success',
        ]);
    }
}
