<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSalesTable extends Migration
{
    public function up()
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 20)->nullable()->unique();
            $table->foreignId('customer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('discount_pct', 5, 2)->nullable();
            $table->decimal('total_amount', 12, 2);
            $table->enum('payment_method', ['cod', 'gcash'])->default('cod');
            $table->enum('status', ['pending_payment', 'verifying_payment', 'pending', 'confirmed', 'out_for_delivery', 'delivered', 'returned', 'cancelled'])->default('pending');
            $table->string('payment_phone_number')->nullable();
            $table->string('payment_reference')->nullable();
            $table->string('payment_proof_path')->nullable();
            $table->timestamp('payment_confirmed_at')->nullable();
            $table->timestamp('payment_expiry_sms_sent_at')->nullable();
            $table->string('payment_proof_token', 64)->nullable()->unique();
            $table->text('notes')->nullable();
            
            // Cancellation request tracking fields
            $table->enum('cancellation_status', ['pending', 'approved', 'rejected'])->nullable();
            $table->timestamp('cancellation_requested_at')->nullable();
            $table->foreignId('cancellation_requested_by')->nullable()->constrained('users')->nullOnDelete();
            
            $table->timestamps();
        });

        // Normalized sales cancellations table (separates cancellation concerns)
        Schema::create('sales_cancellations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->unique()->constrained('sales')->onDelete('cascade');
            $table->string('reason', 255);
            $table->text('notes')->nullable();
            $table->foreignId('cancelled_by')->constrained('users')->onDelete('cascade');
            $table->timestamp('cancelled_at');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('sales_cancellations');
        Schema::dropIfExists('sales');
    }
}
