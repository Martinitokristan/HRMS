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
        ]);

        // Default Customer
        $customer = User::create([
            'name'     => 'Default Customer',
            'email'    => 'customer@hrms.com',
            'phone'    => '09391234567',
            'role'     => 'customer',
            'status'   => 'active',
            'password' => Hash::make('password'),
        ]);

        \App\Models\CustomerProfile::create([
            'user_id'      => $customer->id,
            'age'          => 28,
            'sex'          => 'male',
            'province'     => 'Davao del Sur',
            'municipality' => 'Davao City',
            'zip_code'     => '8000',
            'address'      => 'Quimpo Blvd, Ecoland',
            'landmark'     => 'SM City Davao',
            'latitude'     => 7.0543,
            'longitude'    => 125.5947,
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
        // These are essential for the Product Matrix UI to function correctly.
        // We keep the IDs 1, 2, and 3 for Size, Color, and Weight.
        
        Variant::create([
            'id'          => 1,
            'name'        => 'Size', 
            'status'      => 'active', 
            'description' => 'Physical dimensions or measurements (e.g. 1/2 inch, Small)'
        ]);

        Variant::create([
            'id'          => 2,
            'name'        => 'Color', 
            'status'      => 'active', 
            'description' => 'Product color, finish, or pattern'
        ]);

        Variant::create([
            'id'          => 3,
            'name'        => 'Weight', 
            'status'      => 'active', 
            'description' => 'Product weight or volume class (e.g. grams, kg, ml)'
        ]);

        // No Variant Values, Categories, Suppliers, or Products are created here.
        // The user will start fresh via the HRMS dashboard.
        
        // ─── 4. UNIT TYPES ────────────────────────────────────────────────────
        $this->call(UnitTypeSeeder::class);
        
        // ─── 5. SUPPLIERS ────────────────────────────────────────────────────
        $this->call(SupplierSeeder::class);
        
        // ─── 6. RIDERS ───────────────────────────────────────────────────────
        $this->call(RiderSeeder::class);
    }
}
