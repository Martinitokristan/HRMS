<?php

namespace App\Services\Settings;

use App\Models\Setting;
use App\Events\DataMutated;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    /**
     * Get all settings with optional masterlist data.
     */
    public function getAll($user = null, $includeMasterlist = false, $includeVariants = false)
    {
        $cacheKey = 'settings:all';
        $isTaggable = Cache::getStore() instanceof \Illuminate\Cache\TaggableStore;

        $allSettings = $isTaggable
            ? Cache::tags(['settings'])->remember($cacheKey, 86400, fn() => Setting::all())
            : Cache::remember($cacheKey, 86400, fn() => Setting::all());

        $isAdmin = $user && $user->role === 'admin';
        if (!$isAdmin) {
            $allSettings = $allSettings->whereNotIn('group', ['security', 'notifications']);
        }

        $settings = $allSettings->groupBy('group')->map(function ($group) {
            return $group->pluck('value', 'key');
        });

        $response = [
            'settings' => $settings,
        ];

        if ($includeMasterlist) {
            $response['categories'] = \App\Models\Category::all(['id', 'name']);
            $response['unitTypes'] = \App\Models\UnitType::all(['id', 'purchase_unit', 'sell_unit']);

            if ($includeVariants) {
                $response['variants'] = \App\Models\Variant::with('values')->get();
            }
        }

        return [
            'data' => $response,
            'status_code' => 200,
        ];
    }

    /**
     * Update settings.
     */
    public function update($group, $settings)
    {
        foreach ($settings as $key => $value) {
            Setting::set($key, $value, $group);
        }

        if (Cache::getStore() instanceof \Illuminate\Cache\TaggableStore) {
            Cache::tags(['settings'])->flush();
        } else {
            Cache::forget('settings:all');
        }

        if ($group === 'payments') {
            broadcast(new DataMutated('shop', ['customer_shop'], 'payment_settings.updated'));
        }

        return [
            'data' => ['message' => 'Settings saved successfully'],
            'status_code' => 200,
        ];
    }
}
