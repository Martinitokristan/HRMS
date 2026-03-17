<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePurchaseOrderItemsTable extends Migration
{
    public function up()
    {
        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->onDelete('cascade');
            $table->foreignId('product_id')->nullable()->constrained('products')->onDelete('cascade');
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->onDelete('set null');
            $table->foreignId('supplier_product_id')->nullable()->constrained('supplier_products')->onDelete('set null');
            $table->foreignId('supplier_product_variant_id')->nullable()->constrained('supplier_product_variants', 'id', 'po_items_svid_fk')->onDelete('set null');
            $table->decimal('quantity', 10, 2);
            $table->decimal('unit_cost', 10, 2);
            $table->decimal('subtotal', 12, 2);
        });
    }

    public function down()
    {
        Schema::dropIfExists('purchase_order_items');
    }
}
