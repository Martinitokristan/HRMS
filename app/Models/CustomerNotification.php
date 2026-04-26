<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerNotification extends Model
{
    protected $fillable = [
        'customer_id', 'delivery_id', 'type', 'title', 'message', 'meta', 'is_read',
    ];

    protected $casts = [
        'meta' => 'array',
        'is_read' => 'boolean',
    ];

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function delivery()
    {
        return $this->belongsTo(Delivery::class);
    }

    /**
     * Wave 9 — broadcast DataMutated when a notification is created.
     * Uses the user's role to determine the appropriate private channel.
     */
    protected static function booted(): void
    {
        static::created(function (self $notif): void {
            try {
                $role = optional(\App\Models\User::find($notif->customer_id))->role;

                if ($role === 'admin') {
                    $channel = 'private-admin';
                } elseif ($role === 'rider') {
                    $channel = 'private-rider.' . $notif->customer_id;
                } elseif ($role === 'customer') {
                    $channel = 'private-customer.' . $notif->customer_id;
                } else {
                    $channel = null;
                }

                if ($channel === null) {
                    return;
                }

                event(new \App\Events\DataMutated(
                    $channel,
                    ['notifications', 'notifications.count'],
                    'notification.created'
                ));
            } catch (\Throwable $e) {
                \Log::warning('CustomerNotification broadcast failed: ' . $e->getMessage());
            }
        });
    }
}
