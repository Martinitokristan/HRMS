<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateRiderProfilesTable extends Migration
{
    public function up()
    {
        Schema::create('rider_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->onDelete('cascade');
            $table->string('vehicle_type', 50)->nullable();
            $table->string('plate_number', 20)->nullable();
            $table->decimal('current_latitude', 10, 7)->nullable();
            $table->decimal('current_longitude', 10, 7)->nullable();
            $table->string('valid_id_type')->nullable();
            $table->string('valid_id_path')->nullable();
            $table->string('license_number')->nullable();
            $table->text('address')->nullable();
            $table->dateTime('interview_at')->nullable();
            $table->enum('availability', ['available', 'on_delivery', 'off_duty'])->default('available');
            $table->unsignedInteger('total_deliveries')->default(0);
            $table->unsignedInteger('on_time_count')->default(0);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('rider_profiles');
    }
}
