<?php

namespace App\Http\Controllers;

use App\Services\Riders\RiderQueryService;
use App\Services\Riders\RiderProfileService;
use App\Services\Riders\RiderDashboardService;
use App\Services\Riders\RiderLocationService;
use App\Services\Riders\RiderWalletService;
use App\Services\Riders\RiderNotificationService;
use App\Services\Riders\RiderOnboardingService;
use Illuminate\Http\Request;

class RiderController extends Controller
{

    /**
     * List all riders (admin).
     */
    public function index(Request $request, RiderQueryService $queryService)
    {
        $result = $queryService->index(
            $request->get('search'),
            $request->get('status'),
            $request->get('per_page', 20)
        );

        return response()->json([
            'data' => $result['data'],
            'counts' => $result['counts'],
            'status' => 'success'
        ], $result['status_code']);
    }

    /**
     * Get stats for a specific rider.
     */
    public function stats($id, RiderQueryService $queryService)
    {
        $result = $queryService->stats($id);

        return response()->json([
            'data' => $result['data'],
            'status' => 'success'
        ], $result['status_code']);
    }

    /**
     * Get my deliveries (for authenticated rider).
     */
    public function myDeliveries(Request $request, RiderQueryService $queryService)
    {
        $result = $queryService->myDeliveries($request->user()->id);

        return response()->json([
            'data' => $result['data'],
            'status' => 'success',
        ], $result['status_code']);
    }

    /**
     * Get rating stats for authenticated rider.
     */
    public function getRatingStats(Request $request, RiderQueryService $queryService)
    {
        $result = $queryService->getRatingStats($request->user()->id);

        return response()->json([
            'data' => $result['data'],
            'status' => 'success'
        ], $result['status_code']);
    }

    /**
     * Toggle rider availability (on-duty/off-duty).
     */
    public function toggleStatus(Request $request, RiderProfileService $profileService)
    {
        $result = $profileService->toggleStatus($request->user()->id);

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Get all available riders.
     */
    public function availableRiders(RiderQueryService $queryService)
    {
        $result = $queryService->availableRiders();

        return response()->json([
            'data' => $result['data'],
            'status' => 'success'
        ], $result['status_code']);
    }

    /**
     * Get rider dashboard with deliveries and nearby jobs.
     */
    public function dashboard(Request $request, RiderDashboardService $dashboardService)
    {
        $result = $dashboardService->getDashboard(
            $request->user()->id,
            $request->get('latitude'),
            $request->get('longitude')
        );

        if (isset($result['error'])) {
            return response()->json([
                'error' => $result['error'],
                'message' => $result['message'] ?? 'Failed to load dashboard',
                'status' => 'error'
            ], $result['status_code']);
        }

        return response()->json([
            'data' => $result['data'],
            'status' => 'success',
        ], $result['status_code']);
    }

    /**
     * Schedule interview for rider (admin).
     */
    public function scheduleInterview(Request $request, $id, RiderOnboardingService $onboardingService)
    {
        $data = $request->validate(['interview_at' => 'required|date']);

        $result = $onboardingService->scheduleInterview($id, $data['interview_at']);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Interview scheduled successfully.'
        ], $result['status_code']);
    }

    /**
     * Approve rider from onboarding (admin).
     */
    public function approveRider($id, RiderProfileService $profileService)
    {
        $result = $profileService->approveRider($id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Rider hired and activated!'
        ], $result['status_code']);
    }

    /**
     * Update rider profile.
     */
    public function updateProfile(Request $request, RiderProfileService $profileService)
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'sometimes|nullable|string|email|max:255|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20|unique:users,phone,' . $user->id,
            'address' => 'nullable|string|max:500',
        ]);

        $result = $profileService->updateProfile($user->id, $data);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Profile updated successfully',
            'user' => $result['data']
        ], $result['status_code']);
    }

    /**
     * Update rider profile photo.
     */
    public function updatePhoto(Request $request, RiderProfileService $profileService)
    {
        $request->validate([
            'photo' => 'required|image|max:2048|dimensions:max_width=4000,max_height=4000',
        ]);

        $result = $profileService->updatePhoto($request->user()->id, $request->file('photo'));

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Photo updated successfully',
            'photo_url' => $result['data']['photo_url'],
            'user' => $result['data']['user']
        ], $result['status_code']);
    }

    /**
     * Update rider password/security.
     */
    public function updateSecurity(Request $request, RiderProfileService $profileService)
    {
        $request->validate([
            'current_password' => 'required|current_password',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $result = $profileService->updateSecurity($request->user()->id, $request->password);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Password changed successfully'
        ], $result['status_code']);
    }

    /**
     * Get notifications for rider.
     */
    public function getNotifications(Request $request, RiderNotificationService $notificationService)
    {
        $result = $notificationService->getNotifications($request->user());

        return response()->json([
            'status' => 'success',
            'data' => $result['data'],
            'unread_count' => $result['unread_count']
        ], $result['status_code']);
    }

    /**
     * Mark all notifications as read.
     */
    public function markNotificationsRead(Request $request, RiderNotificationService $notificationService)
    {
        $result = $notificationService->markAllAsRead($request->user());

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Delete a single notification.
     */
    public function deleteNotification(Request $request, $id, RiderNotificationService $notificationService)
    {
        $result = $notificationService->deleteNotification($request->user(), $id);

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Delete multiple notifications.
     */
    public function deleteBatchNotifications(Request $request, RiderNotificationService $notificationService)
    {
        $request->validate(['ids' => 'required|array']);

        $result = $notificationService->deleteBatch($request->user(), $request->ids);

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Delete all notifications.
     */
    public function deleteAllNotifications(Request $request, RiderNotificationService $notificationService)
    {
        $result = $notificationService->deleteAll($request->user());

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Update rider location.
     */
    public function updateLocation(Request $request, RiderLocationService $locationService)
    {
        $data = $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'broadcast' => 'boolean'
        ]);

        $result = $locationService->updateLocation(
            $request->user()->id,
            $data['latitude'],
            $data['longitude'],
            $request->boolean('broadcast')
        );

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Get rider wallet and earnings.
     */
    public function wallet(Request $request, RiderWalletService $walletService)
    {
        $result = $walletService->getWallet($request->user()->id);

        return response()->json([
            'data' => $result['data'],
            'status' => 'success'
        ], $result['status_code']);
    }

    /**
     * Get rider delivery history.
     */
    public function history(Request $request, RiderWalletService $walletService)
    {
        $result = $walletService->getHistory(
            $request->user()->id,
            $request->get('page', 1),
            $request->get('per_page', 20),
            $request->get('from'),
            $request->get('to')
        );

        return response()->json([
            'status' => 'success',
            'data' => $result['data'],
            'meta' => $result['meta']
        ], $result['status_code']);
    }
}
