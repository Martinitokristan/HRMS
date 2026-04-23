<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->foreignId('size_value_id')->nullable()->constrained('variant_values')->onDelete('set null');
            $table->foreignId('color_value_id')->nullable()->constrained('variant_values')->onDelete('set null');
            $table->foreignId('weight_value_id')->nullable()->constrained('variant_values')->onDelete('set null');
            $table->integer('stock')->default(0);
            $table->decimal('price_override', 10, 2)->nullable();
            $table->string('barcode')->nullable();
            $table->decimal('sale_percentage', 5, 2)->default(0);
            $table->string('image_path')->nullable();
            $table->timestamps();
        });

        // Normalized product variant images table (replaces additional_images JSON)
        Schema::create('product_variant_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variant_id')->constrained('product_variants')->onDelete('cascade');
            $table->string('image_path');
            $table->boolean('is_primary')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('alt_text')->nullable();
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
        Schema::dropIfExists('product_variant_images');
        Schema::dropIfExists('product_variants');
    }
};
