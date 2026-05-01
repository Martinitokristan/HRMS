<?php

namespace App\Services\Riders;

class RiderNotificationService
{
    /**
     * Get all notifications for a rider.
     */
    public function getNotifications($user)
    {
        $notifications = $user->notifications()->latest()->limit(50)->get();

        return [
            'data'         => $notifications->toArray(),
            'unread_count' => $notifications->whereNull('read_at')->count(),
            'status'       => 'success',
            'status_code'  => 200,
        ];
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead($user)
    {
        $user->unreadNotifications->markAsRead();

        return [
            'status' => 'success',
            'status_code' => 200,
        ];
    }

    /**
     * Delete a single notification.
     */
    public function deleteNotification($user, $notificationId)
    {
        $user->notifications()->where('id', $notificationId)->delete();

        return [
            'status' => 'success',
            'status_code' => 200,
        ];
    }

    /**
     * Delete multiple notifications by IDs.
     */
    public function deleteBatch($user, $ids)
    {
        $user->notifications()->whereIn('id', $ids)->delete();

        return [
            'status' => 'success',
            'status_code' => 200,
        ];
    }

    /**
     * Delete all notifications for a user.
     */
    public function deleteAll($user)
    {
        $user->notifications()->delete();

        return [
            'status' => 'success',
            'status_code' => 200,
        ];
    }
}
