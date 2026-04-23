<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateProductReviewsTable extends Migration
{
    public function up()
    {
        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->foreignId('customer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->tinyInteger('rating')->unsigned();
            $table->string('title', 100)->nullable();
            $table->text('review_text')->nullable();
            $table->boolean('is_verified_purchase')->default(false);
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('admin_response')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'status']);
            $table->index(['customer_id', 'product_id']);
        });

        // Normalized product review images table (replaces images JSON)
        Schema::create('product_review_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->constrained('product_reviews')->onDelete('cascade');
            $table->string('image_path');
            $table->string('alt_text')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('review_helpfulness', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->constrained('product_reviews')->onDelete('cascade');
            $table->foreignId('customer_id')->constrained('users')->onDelete('cascade');
            $table->boolean('is_helpful');
            $table->timestamps();

            $table->unique(['review_id', 'customer_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('review_helpfulness');
        Schema::dropIfExists('product_review_images');
        Schema::dropIfExists('product_reviews');
    }
}
