<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\RiderProfile;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RiderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create a default rider account
        $rider = User::create([
            'name'     => 'John Rider',
            'email'    => 'rider@hrms.com',
            'phone'    => '09181234567',
            'role'     => 'rider',
            'status'   => 'active',
            'password' => Hash::make('password'),
        ]);

        // Create rider profile
        RiderProfile::create([
            'user_id'           => $rider->id,
            'license_number'    => 'N01-12-345678',
            'vehicle_type'      => 'motorcycle',
            'vehicle_model'     => 'Honda TMX 155',
            'plate_number'      => 'ABC-1234',
            'id_type'           => 'drivers_license',
            'id_number'         => 'N01-12-345678',
            'id_file_path'      => null,
            'emergency_contact' => '09191234567',
            'address'           => 'Davao City',
            'availability'      => 'available',
        ]);
    }
}
