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
            $table->string('sku_suffix')->nullable();
            $table->string('image_path')->nullable();
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
        Schema::dropIfExists('product_variants');
    }
};
