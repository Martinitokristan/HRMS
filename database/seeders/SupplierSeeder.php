<?php

namespace Database\Seeders;

use App\Models\Supplier;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SupplierSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $suppliers = [
            [
                'name' => 'ABC Hardware Supplies',
                'contact_name' => 'Juan Dela Cruz',
                'email' => 'supplier1@test.com',
                'password' => Hash::make('password'),
                'status' => 'active',
                'phone' => '09171234567',
                'address' => '123 Supplier St, Manila',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'XYZ Building Materials',
                'contact_name' => 'Maria Santos',
                'email' => 'supplier2@test.com',
                'password' => Hash::make('password'),
                'status' => 'active',
                'phone' => '09171234568',
                'address' => '456 Industrial Ave, Quezon City',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'DEF Tools & Equipment',
                'contact_name' => 'Pedro Reyes',
                'email' => 'supplier3@test.com',
                'password' => Hash::make('password'),
                'status' => 'active',
                'phone' => '09171234569',
                'address' => '789 Commerce Blvd, Makati',
                'email_verified_at' => now(),
            ],
        ];

        foreach ($suppliers as $supplierData) {
            Supplier::updateOrCreate(
                ['email' => $supplierData['email']],
                $supplierData
            );
        }

        $this->command->info('Suppliers seeded successfully!');
        $this->command->info('Login credentials:');
        foreach ($suppliers as $supplier) {
            $this->command->info("  - {$supplier['name']}: {$supplier['email']} / password");
        }
    }
}
