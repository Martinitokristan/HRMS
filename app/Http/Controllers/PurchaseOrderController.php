<?php

namespace App\Http\Controllers;

use App\Services\PurchaseOrders\PurchaseOrderQueryService;
use App\Services\PurchaseOrders\PurchaseOrderCreationService;
use App\Services\PurchaseOrders\PurchaseOrderApprovalService;
use App\Services\PurchaseOrders\PurchaseOrderSupplierService;
use App\Services\PurchaseOrders\PurchaseOrderReceivingService;
use App\Services\PurchaseOrders\PurchaseOrderReportService;
use App\Models\Supplier;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{

    /**
     * List all purchase orders.
     */
    public function index(Request $request, PurchaseOrderQueryService $queryService)
    {
        $result = $queryService->list(
            $request->get('tab'),
            $request->get('status'),
            $request->get('search'),
            $request->get('per_page', 20)
        );

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Create new purchase order.
     */
    public function store(Request $request, PurchaseOrderCreationService $creationService)
    {
        $data = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.supplier_product_id' => 'nullable|exists:supplier_products,id',
            'items.*.supplier_product_variant_id' => 'nullable|exists:supplier_product_variants,id',
            'items.*.quantity' => 'required|numeric|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'expected_date' => 'nullable|date',
        ]);

        $result = $creationService->create($data, $request->user()->id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Order request sent successfully', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Get single purchase order.
     */
    public function show($id, PurchaseOrderQueryService $queryService)
    {
        $result = $queryService->show($id);

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Approve purchase order.
     */
    public function approve($id, PurchaseOrderApprovalService $approvalService)
    {
        $result = $approvalService->approve($id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Purchase order approved and sent to supplier.', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Decline purchase order.
     */
    public function decline($id, PurchaseOrderApprovalService $approvalService)
    {
        $result = $approvalService->decline($id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Purchase order has been declined. Stock has been restored.', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Supplier accept purchase order.
     */
    public function accept($id, Request $request, PurchaseOrderSupplierService $supplierService)
    {
        $supplierId = $this->resolveSupplierID($request);

        $result = $supplierService->accept($supplierId, $id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Purchase order accepted. Awaiting delivery confirmation.', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Supplier reject purchase order.
     */
    public function reject($id, Request $request, PurchaseOrderSupplierService $supplierService)
    {
        $data = $request->validate(['rejection_reason' => 'required|string|min:10|max:1000']);

        $supplierId = $this->resolveSupplierID($request);

        $result = $supplierService->reject($supplierId, $id, $data['rejection_reason']);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Purchase order rejected. Stock has been restored.', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Mark purchase order as received.
     */
    public function markReceived($id, PurchaseOrderReceivingService $receivingService)
    {
        $result = $receivingService->markReceived($id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Purchase order received. Stock added to Warehouse inventory.', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Get supplier's purchase orders.
     */
    public function supplierIndex(Request $request, PurchaseOrderQueryService $queryService)
    {
        $supplierId = $this->resolveSupplierID($request);

        $result = $queryService->supplierList(
            $supplierId,
            $request->get('tab'),
            $request->get('status'),
            $request->get('per_page', 20)
        );

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Get supplier's single purchase order.
     */
    public function supplierShow($id, Request $request, PurchaseOrderQueryService $queryService)
    {
        $supplierId = $this->resolveSupplierID($request);

        $result = $queryService->supplierShow($supplierId, $id);

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Supplier mark as delivered.
     */
    public function deliver($id, Request $request, PurchaseOrderSupplierService $supplierService)
    {
        $data = $request->validate(['delivery_notes' => 'nullable|string|max:500']);

        $supplierId = $this->resolveSupplierID($request);

        $result = $supplierService->deliver($supplierId, $id, $data['delivery_notes'] ?? null);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'message' => 'Purchase order marked as delivered', 'status' => 'success'], $result['status_code']);
    }

    /**
     * Get supplier revenue report.
     */
    public function revenueReport(Request $request, PurchaseOrderReportService $reportService)
    {
        $supplierId = $this->resolveSupplierID($request);

        $result = $reportService->revenueReport(
            $supplierId,
            $request->get('period', 'year'),
            $request->get('year'),
            $request->get('month')
        );

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Resolve supplier ID from authenticated user.
     */
    private function resolveSupplierID(Request $request): int
    {
        $user = $request->user();

        if ($user instanceof \App\Models\Supplier) {
            return $user->id;
        }

        $supplier = Supplier::where('email', $user->email)->first();
        if (!$supplier) {
            abort(403, 'No supplier account linked to this user.');
        }

        return $supplier->id;
    }
}
