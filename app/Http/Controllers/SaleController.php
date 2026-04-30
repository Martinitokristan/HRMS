<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use Illuminate\Http\Request;
use App\Services\Sales\SaleQueryService;
use App\Services\Sales\OrderCreationService;
use App\Services\Sales\SaleStatusService;
use App\Services\Sales\SaleCancellationService;
use App\Services\Sales\SaleRefundService;
use App\Services\Sales\GcashProofService;
use App\Services\Sales\SaleCancellationPolicyService;

class SaleController extends Controller
{
    public function index(Request $request, SaleQueryService $queryService)
    {
        $data = $queryService->getList($request);

        return response()->json([
            'data' => $data,
            'status' => 'success',
        ]);
    }

    public function store(Request $request, OrderCreationService $orders)
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.quantity' => 'required|numeric|min:1',
            'items.*.price' => 'nullable|numeric|min:0',
            'payment_method' => 'required|in:cod,gcash',
            'payment_phone_number' => 'nullable|string|max:20',
            'discount_pct' => 'nullable|numeric|between:0,100',
            'notes' => 'nullable|string',
            'address' => 'nullable|string',
        ]);

        $result = $orders->create($data, $request->user());

        return response()->json([
            'data' => $result['sale'],
            'gcash_payload' => $result['gcash_payload'],
            'message' => 'Order created successfully',
            'status' => 'success',
        ], 201);
    }

    public function show(Request $request, $id, SaleQueryService $queryService)
    {
        $result = $queryService->getDetail($id, $request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json(['data' => $result['sale'], 'status' => 'success']);
    }

    public function updateStatus(Request $request, $id, SaleStatusService $statusService)
    {
        $sale = Sale::with(['delivery'])->findOrFail($id);

        $request->validate([
            'status' => 'required|in:pending,confirmed,cancelled,pending_payment',
        ]);

        $result = $statusService->updateStatus($sale, $request->status);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['sale'],
            'message' => 'Order status updated to ' . $request->status,
            'status' => 'success',
        ]);
    }

    public function processReturn(Request $request, $id, SaleStatusService $statusService)
    {
        $sale = Sale::with('items')->findOrFail($id);

        $result = $statusService->processReturn($sale);

        return response()->json([
            'data' => $result['sale'],
            'message' => 'Order returned successfully',
            'status' => 'success',
        ]);
    }

    /**
     * POST /sales/{id}/cancel-pending-payment
     * Cancels a GCash sale in pending_payment status.
     */
    public function cancelPendingPayment(Request $request, $id, SaleStatusService $statusService)
    {
        $sale = Sale::with(['items', 'delivery'])->findOrFail($id);

        $result = $statusService->cancelPendingPayment($sale, $request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['sale'],
            'message' => 'Order cancelled successfully. Stock has been restored.',
            'status' => 'success',
        ]);
    }

    public function cancelOrder(Request $request, $id, SaleCancellationPolicyService $policy)
    {
        $sale = Sale::with(['items', 'delivery'])->findOrFail($id);

        $request->validate([
            'reason' => 'required|string|in:changed_mind,wrong_item,duplicate_order,price_issue,found_better,too_long,other',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $isAdmin = in_array($user->role, ['admin', 'manager']);
        $isOwner = $sale->customer_id === $user->id;

        if (in_array($sale->status, ['cancelled', 'returned', 'delivered'])) {
            return response()->json([
                'message' => 'This order can no longer be cancelled.',
                'status' => 'error',
            ], 422);
        }

        $isCustomer = !$isAdmin;
        if ($isCustomer && in_array($sale->status, ['pending', 'confirmed'])) {
            // Customer requests approval
            $result = $policy->directCancel($sale, $user, $request->reason, $request->notes);
            if (isset($result['error'])) {
                // Instead of cancel, create cancellation request
                $cancellationService = app(\App\Services\Sales\SaleCancellationService::class);
                $requestResult = $cancellationService->requestCancellation($sale, $user, $request->reason, $request->notes);
                return response()->json([
                    'data' => $requestResult['sale'],
                    'message' => 'Cancellation request submitted and pending admin approval.',
                    'status' => 'pending_request',
                ]);
            }
            return response()->json([
                'data' => $result['sale'],
                'message' => 'Order cancelled successfully. Stock has been restored.',
                'status' => 'success',
            ]);
        }

        // Admin cancels directly
        $result = $policy->directCancel($sale, $user, $request->reason, $request->notes);
        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['sale'],
            'message' => 'Order cancelled successfully. Stock has been restored.',
            'status' => 'success',
        ]);
    }

    public function getCancellationRequests(Request $request, SaleCancellationService $service)
    {
        $paginated = $service->getPendingRequests($request);

        return response()->json([
            'data' => $paginated,
            'status' => 'success',
        ]);
    }

    public function approveCancellation(Request $request, $id, SaleCancellationService $service)
    {
        $sale = Sale::with(['items', 'delivery', 'cancellationRequest'])->findOrFail($id);

        $result = $service->approve($sale, $request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['sale'],
            'message' => 'Cancellation request approved successfully.',
            'status' => 'success',
        ]);
    }

    public function rejectCancellation(Request $request, $id, SaleCancellationService $service)
    {
        $validated = $request->validate([
            'admin_notes' => 'nullable|string|max:500',
        ]);

        $sale = Sale::with(['delivery', 'cancellationRequest'])->findOrFail($id);

        $result = $service->reject($sale, $request->user(), $validated['admin_notes'] ?? null);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['sale'],
            'message' => 'Cancellation request rejected successfully.',
            'status' => 'success',
        ]);
    }

    public function markRefunded(Request $request, $id, SaleRefundService $service)
    {
        $sale = Sale::findOrFail($id);

        $result = $service->markRefunded($sale, $request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['sale'],
            'message' => 'Refund marked as completed.',
            'status' => 'success',
        ]);
    }

    public function uploadGCashProof(Request $request, $id, GcashProofService $service)
    {
        $sale = Sale::findOrFail($id);

        $request->validate([
            'payment_proof' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120|dimensions:max_width=4000,max_height=4000',
            'payment_reference' => 'nullable|string|max:50',
        ]);

        $result = $service->uploadProof($sale, $request->user(), $request->file('payment_proof'), $request->payment_reference);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['sale'],
            'message' => 'Payment proof uploaded successfully',
            'status' => 'success'
        ]);
    }

    public function cancellationPolicy(Request $request, $id, SaleCancellationPolicyService $policy)
    {
        $sale = Sale::findOrFail($id);

        $result = $policy->getPolicy($sale, $request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['policy'],
            'status' => 'success',
        ]);
    }

    public function summary(Request $request, SaleQueryService $queryService)
    {
        $summary = $queryService->getSummary();

        return response()->json([
            'data' => $summary,
            'status' => 'success',
        ]);
    }
}
