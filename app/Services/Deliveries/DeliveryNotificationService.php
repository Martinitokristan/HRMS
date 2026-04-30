<?php

namespace App\Services\Deliveries;

use App\Models\CustomerNotification;

class DeliveryNotificationService
{
    /**
     * Get customer notifications.
     */
    public function getNotifications($user, $limit = 20)
    {
        $notifications = CustomerNotification::where('customer_id', $user->id)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return [
            'notifications' => $notifications,
            'unread_count' => $notifications->where('is_read', false)->count(),
        ];
    }

    /**
     * Mark all notifications as read for customer.
     */
    public function markAllAsRead($user)
    {
        CustomerNotification::where('customer_id', $user->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return ['status_code' => 200];
    }

    /**
     * Delete a notification.
     */
    public function deleteNotification($user, $notificationId)
    {
        CustomerNotification::where('customer_id', $user->id)
            ->where('id', $notificationId)
            ->delete();

        return ['status_code' => 200];
    }

    /**
     * Delete batch notifications.
     */
    public function deleteBatch($user, $ids)
    {
        CustomerNotification::where('customer_id', $user->id)
            ->whereIn('id', $ids)
            ->delete();

        return ['status_code' => 200];
    }

    /**
     * Delete all notifications for customer.
     */
    public function deleteAll($user)
    {
        CustomerNotification::where('customer_id', $user->id)->delete();

        return ['status_code' => 200];
    }
}
