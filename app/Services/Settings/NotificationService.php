<?php

namespace App\Services\Settings;

class NotificationService
{
    /**
     * Resolve notifiable user or supplier.
     */
    private function resolveNotifiable($user)
    {
        if ($user === null) {
            return [
                'error' => 'Authentication required.',
                'status_code' => 401,
            ];
        }

        if ($user instanceof \App\Models\User && $user->role === 'supplier') {
            $supplier = \App\Models\Supplier::where('email', $user->email)->first();
            return $supplier ?? $user;
        }

        return $user;
    }

    /**
     * Get user notifications.
     */
    public function getNotifications($user)
    {
        $notifiable = $this->resolveNotifiable($user);

        if (isset($notifiable['error'])) {
            return $notifiable;
        }

        $notifications = $notifiable->notifications()->orderBy('created_at', 'desc')->take(30)->get();
        $unreadCount = $notifiable->unreadNotifications()->count();

        return [
            'data' => $notifications->toArray(),
            'unread_count' => $unreadCount,
            'status' => 'success',
        ];
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead($user)
    {
        $notifiable = $this->resolveNotifiable($user);

        if (isset($notifiable['error'])) {
            return $notifiable;
        }

        $notifiable->unreadNotifications->markAsRead();

        return [
            'status' => 'success',
        ];
    }

    /**
     * Delete single notification.
     */
    public function deleteNotification($user, $notificationId)
    {
        $notifiable = $this->resolveNotifiable($user);

        if (isset($notifiable['error'])) {
            return $notifiable;
        }

        $notifiable->notifications()->where('id', $notificationId)->delete();

        return [
            'status' => 'success',
        ];
    }

    /**
     * Delete batch of notifications.
     */
    public function deleteBatch($user, $ids)
    {
        $notifiable = $this->resolveNotifiable($user);

        if (isset($notifiable['error'])) {
            return $notifiable;
        }

        $notifiable->notifications()->whereIn('id', $ids)->delete();

        return [
            'status' => 'success',
        ];
    }

    /**
     * Delete all notifications.
     */
    public function deleteAll($user)
    {
        $notifiable = $this->resolveNotifiable($user);

        if (isset($notifiable['error'])) {
            return $notifiable;
        }

        $notifiable->notifications()->delete();

        return [
            'status' => 'success',
        ];
    }
}
