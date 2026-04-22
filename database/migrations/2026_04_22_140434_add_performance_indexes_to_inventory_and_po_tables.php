<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddPerformanceIndexesToInventoryAndPoTables extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->index('product_id', 'idx_inv_product_id');
            $table->index('product_variant_id', 'idx_inv_product_variant_id');
            $table->index('supplier_product_id', 'idx_inv_supplier_product_id');
            $table->index('supplier_product_variant_id', 'idx_inv_supplier_product_variant_id');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->index('status', 'idx_po_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropIndex('idx_inv_product_id');
            $table->dropIndex('idx_inv_product_variant_id');
            $table->dropIndex('idx_inv_supplier_product_id');
            $table->dropIndex('idx_inv_supplier_product_variant_id');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex('idx_po_status');
        });
    }
}
