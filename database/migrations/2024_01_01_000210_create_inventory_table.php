<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateInventoryTable extends Migration
{
    public function up()
    {
        Schema::create('inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained('products')->onDelete('cascade');
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->onDelete('cascade');
            $table->foreignId('supplier_product_id')->nullable()->constrained('supplier_products')->onDelete('set null');
            $table->decimal('current_stock', 10, 2)->default(0);
            $table->decimal('warehouse_stock', 10, 2)->default(0)->comment('Stock received from POs, not yet pushed to storefront');
            $table->decimal('reorder_threshold', 10, 2)->default(10);
            $table->timestamp('last_adjusted_at')->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'product_variant_id', 'supplier_product_id'], 'inventory_refined_unique');
        });
    }

    public function down()
    {
        Schema::dropIfExists('inventory');
    }
}
