<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Supplier;
use App\Models\UnitType;
use App\Models\User;
use App\Models\Variant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     * 
     * FLOW:
     * 1. Essential Users (1 Admin, 1 Customer)
     * 2. Essential System Settings
     * 3. Essential Master Variant Types (Size, Color, Weight)
     * No sample products, categories, or variant values.
     */
    public function run()
    {
        // ─── 1. USERS ────────────────────────────────────────────────────────
        
        // Root Admin
        User::create([
            'name'     => 'HRMS Admin',
            'email'    => 'admin@hrms.com',
            'phone'    => '09171234567',
            'role'     => 'admin',
            'status'   => 'active',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
        ]);

        // Default Customer
        $customer = User::create([
            'name'     => 'Default Customer',
            'email'    => 'customer@hrms.com',
            'phone'    => '09391234567',
            'role'     => 'customer',
            'status'   => 'active',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
        ]);

        \App\Models\CustomerProfile::create([
            'user_id'           => $customer->id,
            'age'               => 28,
            'sex'               => 'male',
            'region_code'       => '11',
            'region_name'       => 'Region XI (Davao Region)',
            'province_code'     => '1140',
            'province_name'     => 'Davao del Sur',
            'city_code'         => '114027',
            'city_name'         => 'Davao City',
            'barangay_code'     => '114027021',
            'barangay_name'     => 'Ecoland',
            'street'            => 'Quimpo Blvd, Ecoland',
            'zip_code'          => '8000',
            'address'           => 'Quimpo Blvd, Ecoland',
            'landmark'          => 'SM City Davao',
            'latitude'          => 7.0543,
            'longitude'         => 125.5947,
        ]);

        // ─── 2. SYSTEM SETTINGS ──────────────────────────────────────────────
        
        $defaultSettings = [
            ['key' => 'store_name',          'value' => 'HRMS Hardware Store',     'group' => 'general'],
            ['key' => 'store_address',        'value' => '789 Main St, Manila',     'group' => 'general'],
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
            Setting::create($setting + ['updated_at' => now()]);
        }

        // ─── 3. MASTER VARIANT TYPES ──────────────────────────────────────────
        // Created automatically via migration: 2024_01_01_000125_seed_master_variant_types.php
        // No need to seed them here.

        
        // ─── 4. UNIT TYPES ────────────────────────────────────────────────────
        $this->call(UnitTypeSeeder::class);
        
        // ─── 5. SUPPLIERS ────────────────────────────────────────────────────
        $this->call(SupplierSeeder::class);
        
        // ─── 6. RIDERS ───────────────────────────────────────────────────────
        $this->call(RiderSeeder::class);
    }
}
