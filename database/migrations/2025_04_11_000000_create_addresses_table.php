<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addresses', function (Blueprint $table) {
            $table->id();

            // Optionally link to a user/customer
            $table->foreignId('user_id')
                  ->nullable()
                  ->constrained()
                  ->nullOnDelete();

            // Region
            $table->string('region_code', 20);
            $table->string('region_name', 100);

            // Province
            $table->string('province_code', 20);
            $table->string('province_name', 100);

            // City / Municipality
            $table->string('city_code', 20);
            $table->string('city_name', 100);

            // Barangay
            $table->string('barangay_code', 20);
            $table->string('barangay_name', 100);

            // Street-level detail
            $table->string('street')->nullable();
            $table->string('zip_code', 10)->nullable();

            // Soft-delete + timestamps
            $table->softDeletes();
            $table->timestamps();

            // Index for common lookups
            $table->index(['user_id']);
            $table->index(['province_code', 'city_code', 'barangay_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
    }
};
