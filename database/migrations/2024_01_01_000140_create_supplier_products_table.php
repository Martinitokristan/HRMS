<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSupplierProductsTable extends Migration
{
    public function up()
    {
        Schema::create('supplier_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained('suppliers')->onDelete('cascade');
            $table->string('name', 150);
            $table->string('sku', 50)->nullable();
            $table->text('description')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->decimal('price', 12, 2)->default(0);
            $table->integer('min_order_qty')->default(1);
            $table->string('image_path')->nullable();
            $table->boolean('is_promoted')->default(false);
            $table->enum('status', ['active', 'inactive', 'pending'])->default('active');
            $table->timestamps();
        });

        Schema::create('supplier_product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_product_id')->constrained('supplier_products')->onDelete('cascade');
            $table->string('size')->nullable();
            $table->string('color')->nullable();
            $table->string('weight')->nullable();
            $table->decimal('price_override', 12, 2)->nullable();
            $table->integer('stock')->default(0);
            $table->string('sku_suffix', 30)->nullable();
            $table->string('image_path')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('supplier_product_variants');
        Schema::dropIfExists('supplier_products');
    }
}
