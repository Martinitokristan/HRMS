<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCustomerProfilesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('customer_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            
            // User information (denormalized from users table)
            $table->string('name', 255)->nullable();
            $table->string('email', 255)->nullable();
            
            // Personal information
            $table->unsignedInteger('age')->nullable();
            $table->enum('sex', ['male', 'female', 'other'])->nullable();
            
            // Simple address fields (text-based, kept for backward compatibility)
            $table->string('address', 255)->nullable();
            $table->string('landmark', 100)->nullable();
            $table->string('zip_code', 10)->nullable();
            
            // PSGC Hierarchical Fields (replaces old province/municipality)
            $table->string('region_code', 20)->nullable();
            $table->string('region_name', 100)->nullable();
            
            $table->string('province_code', 20)->nullable();
            $table->string('province_name', 100)->nullable();
            
            $table->string('city_code', 20)->nullable();
            $table->string('city_name', 100)->nullable();
            
            $table->string('barangay_code', 20)->nullable();
            $table->string('barangay_name', 100)->nullable();
            
            $table->string('street', 255)->nullable();
            
            // Geolocation
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('customer_profiles');
    }
}
