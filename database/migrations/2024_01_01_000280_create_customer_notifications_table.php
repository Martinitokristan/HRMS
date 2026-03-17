<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCustomerNotificationsTable extends Migration
{
    public function up()
    {
        Schema::create('customer_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('delivery_id')->nullable()->constrained('deliveries')->nullOnDelete();
            $table->string('type', 50)->default('proximity'); // proximity, status_update, etc.
            $table->string('title');
            $table->text('message');
            $table->json('meta')->nullable(); // extra data like distance, rider name, etc.
            $table->boolean('is_read')->default(false);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('customer_notifications');
    }
}
