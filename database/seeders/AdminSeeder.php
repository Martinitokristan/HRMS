<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Setting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run()
    {
        // 1. Root Admin
        User::updateOrCreate(
            ['email' => 'admin@hrms.com'],
            [
                'name'     => 'HRMS Admin',
                'phone'    => '09171234567',
                'role'     => 'admin',
                'status'   => 'active',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        // 2. SYSTEM SETTINGS
        $defaultSettings = [
            ['key' => 'store_name',          'value' => 'HRMS Hardware Store',     'group' => 'general'],
            ['key' => 'store_address',        'value' => '7 Street, Butuan City',     'group' => 'general'],
            ['key' => 'contact_email',        'value' => 'store@hrms.com',          'group' => 'general'],
            ['key' => 'currency',             'value' => 'PHP',                     'group' => 'general'],
            ['key' => 'timezone',             'value' => 'Asia/Manila',             'group' => 'general'],
            ['key' => 'low_stock_alerts',     'value' => '1',                       'group' => 'notifications'],
            ['key' => 'new_order_alerts',     'value' => '1',                       'group' => 'notifications'],
            ['key' => 'email_notifications',  'value' => '0',                       'group' => 'notifications'],
            ['key' => 'session_timeout',      'value' => '120',                     'group' => 'security'],
            ['key' => 'max_login_attempts',   'value' => '5',                       'group' => 'security'],
            ['key' => 'suspicious_login',     'value' => '1',                       'group' => 'security'],
        ];

        foreach ($defaultSettings as $setting) {
            Setting::updateOrCreate(['key' => $setting['key']], $setting + ['updated_at' => now()]);
        }

        // 3. UNIT TYPES
        $this->call(UnitTypeSeeder::class);
    }
}
