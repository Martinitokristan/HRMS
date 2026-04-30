<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use Illuminate\Http\Request;
use App\Services\Deliveries\DeliveryQueryService;
use App\Services\Deliveries\DeliveryAssignmentService;
use App\Services\Deliveries\DeliveryStatusService;
use App\Services\Deliveries\DeliveryLocationService;
use App\Services\Deliveries\DeliveryNotificationService;
use App\Services\Deliveries\DeliveryProofService;
use App\Services\Deliveries\DeliveryRatingService;
use App\Services\Deliveries\DeliveryPauseService;
use App\Services\Deliveries\DeliveryReceiptService;

class DeliveryController extends Controller
{
    public function index(Request $request, DeliveryQueryService $queryService)
    {
        $result = $queryService->getList($request);

        return response()->json([
            'data' => $result['deliveries'],
            'stats' => $result['stats'],
            'status' => 'success',
        ]);
    }

    public function show(Request $request, $id, DeliveryQueryService $queryService)
    {
        $result = $queryService->getDetail($id, $request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json(['data' => $result['delivery'], 'status' => 'success']);
    }

    public function destroy($id, DeliveryAssignmentService $assignmentService)
    {
        $result = $assignmentService->delete($id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json(['status' => 'success']);
    }

    public function assignRider(Request $request, $id, DeliveryAssignmentService $assignmentService)
    {
        $request->validate(['rider_id' => 'required|exists:users,id']);

        $delivery = $assignmentService->assign($id, $request->rider_id, $request->user());

        return response()->json([
            'data' => $delivery,
            'message' => 'Rider assigned successfully',
            'status' => 'success',
        ]);
    }

    public function selfAssign(Request $request, $id, DeliveryAssignmentService $assignmentService)
    {
        $result = $assignmentService->selfAssign($id, $request->user());

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['delivery'],
            'message' => 'Order assigned successfully! Please accept to start delivery.',
            'status' => 'success',
        ]);
    }

    public function declineOrder(Request $request, $id, DeliveryAssignmentService $assignmentService)
    {
        $request->validate(['note' => 'required|string|max:500']);

        $result = $assignmentService->decline($id, $request->user(), $request->note);

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json(['message' => 'Order declined successfully', 'status' => 'success']);
    }

    public function updateStatus(Request $request, $id, DeliveryStatusService $statusService)
    {
        $delivery = Delivery::findOrFail($id);

        $request->validate([
            'status' => 'required|in:pending,in_progress,delivered,failed',
            'rider_latitude' => 'nullable|numeric|between:-90,90',
            'rider_longitude' => 'nullable|numeric|between:-180,180',
        ]);

        $result = $statusService->updateStatus(
            $delivery,
            $request->user(),
            $request->status,
            $request->input('rider_latitude'),
            $request->input('rider_longitude')
        );

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json([
            'data' => $result['delivery'],
            'message' => 'Delivery status updated',
            'status' => 'success',
        ]);
    }

    public function riderProximityUpdate(Request $request, $id, DeliveryLocationService $locationService)
    {
        $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        $delivery = Delivery::with(['sale.customer', 'rider'])->findOrFail($id);

        $result = $locationService->riderProximityUpdate($delivery, $request->latitude, $request->longitude);

        return response()->json($result);
    }

    /**
     * Customer polls for their unread notifications.
     */
    public function customerNotifications(Request $request, DeliveryNotificationService $notificationService)
    {
        $result = $notificationService->getNotifications($request->user());

        return response()->json([
            'data' => $result['notifications'],
            'unread' => $result['unread_count'],
            'status' => 'success',
        ]);
    }

    /**
     * Get current rider location for a delivery.
     */
    public function getRiderLocation(Request $request, $id, DeliveryLocationService $locationService)
    {
        $delivery = Delivery::findOrFail($id);

        $result = $locationService->getRiderLocation($delivery, $request->user());

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data']]);
    }

    /**
     * Customer marks notifications as read.
     */
    public function markNotificationsRead(Request $request, DeliveryNotificationService $notificationService)
    {
        $notificationService->markAllAsRead($request->user());

        return response()->json(['status' => 'success']);
    }

    public function deleteNotification(Request $request, $id, DeliveryNotificationService $notificationService)
    {
        $notificationService->deleteNotification($request->user(), $id);
        return response()->json(['status' => 'success']);
    }

    public function deleteBatchNotifications(Request $request, DeliveryNotificationService $notificationService)
    {
        $request->validate(['ids' => 'required|array']);
        $notificationService->deleteBatch($request->user(), $request->ids);
        return response()->json(['status' => 'success']);
    }

    public function deleteAllNotifications(Request $request, DeliveryNotificationService $notificationService)
    {
        $notificationService->deleteAll($request->user());
        return response()->json(['status' => 'success']);
    }

    /**
     * Customer submits rating for delivery.
     */
    public function submitRating(Request $request, $id, DeliveryRatingService $ratingService)
    {
        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        $delivery = Delivery::findOrFail($id);

        $result = $ratingService->submitRating($delivery, $request->user(), $request->rating, $request->comment);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json([
            'data' => $result['data'],
            'status' => 'success',
            'message' => 'Thank you for your feedback!',
        ]);
    }

    public function uploadProof(Request $request, $id, DeliveryProofService $proofService)
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpeg,png,jpg,webp,heic,heif|max:20480',
            'rider_latitude' => 'nullable|numeric|between:-90,90',
            'rider_longitude' => 'nullable|numeric|between:-180,180',
        ]);

        $delivery = Delivery::with('sale.items.product')->findOrFail($id);

        $result = $proofService->uploadProof(
            $delivery,
            $request->user(),
            $request->file('photo'),
            $request->input('rider_latitude'),
            $request->input('rider_longitude')
        );

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json([
            'data' => $result['data'],
            'status' => 'success',
            'message' => 'Delivery marked as complete and proof uploaded successfully',
        ]);
    }

    public function updateLocation(Request $request, $id, DeliveryLocationService $locationService)
    {
        $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
        ]);

        $delivery = Delivery::where('id', $id)
            ->where('rider_id', $request->user()->id)
            ->where('status', 'in_progress')
            ->firstOrFail();

        $result = $locationService->updateLocation($delivery, $request->user(), $request->latitude, $request->longitude);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json([
            'message' => 'Location updated successfully',
            'status' => 'success',
        ]);
    }

    public function getActiveDelivery(Request $request, DeliveryQueryService $queryService)
    {
        $delivery = $queryService->getActiveDelivery($request->user()->id);

        return response()->json([
            'data' => $delivery,
            'status' => 'success',
        ]);
    }

    public function pauseDelivery(Request $request, $id, DeliveryPauseService $pauseService)
    {
        $request->validate([
            'reason' => 'required|string|max:255',
            'resumes_at' => 'nullable|date|after:now',
        ]);

        $delivery = Delivery::findOrFail($id);

        $result = $pauseService->pause(
            $delivery,
            $request->user(),
            $request->reason,
            $request->input('resumes_at')
        );

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'status' => 'success']);
    }

    public function resumeDelivery(Request $request, $id, DeliveryPauseService $pauseService)
    {
        $delivery = Delivery::findOrFail($id);

        $result = $pauseService->resume($delivery, $request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'status' => 'success']);
    }

    /**
     * POST /sales/{id}/customer-confirm-receipt — customer confirms they got the order.
     */
    public function customerConfirmReceipt(Request $request, $id, DeliveryReceiptService $receiptService)
    {
        $sale = \App\Models\Sale::with('delivery')->findOrFail($id);

        $result = $receiptService->customerConfirmReceipt($sale, $request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * POST /sales/{id}/customer-dispute-receipt — customer reports something wrong.
     */
    public function customerDisputeReceipt(Request $request, $id, DeliveryReceiptService $receiptService)
    {
        $request->validate(['reason' => 'required|string|max:500']);

        $sale = \App\Models\Sale::with('delivery')->findOrFail($id);

        $result = $receiptService->customerDisputeReceipt($sale, $request->user(), $request->reason);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json(['status' => 'success']);
    }
}
