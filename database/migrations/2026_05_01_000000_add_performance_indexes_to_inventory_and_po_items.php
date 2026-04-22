<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add indexes on columns that are frequently used as lookup keys in the
 * markReceived() flow.  Without these, every inventory resolution and
 * supplier-product lookup performs a full table scan, which causes lock
 * contention and transaction timeouts under concurrent requests.
 */
class AddPerformanceIndexesToInventoryAndPoItems extends Migration
{
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            // Used to look up inventory by supplier product (base products)
            if (!$this->indexExists('inventory', 'inventory_supplier_product_id_index')) {
                $table->index('supplier_product_id', 'inventory_supplier_product_id_index');
            }

            // Used to look up inventory by supplier variant (variant products)
            if (!$this->indexExists('inventory', 'inventory_supplier_product_variant_id_index')) {
                $table->index('supplier_product_variant_id', 'inventory_supplier_product_variant_id_index');
            }
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            // Used when checking existing products linked to a supplier product
            if (!$this->indexExists('purchase_order_items', 'po_items_supplier_product_id_index')) {
                $table->index('supplier_product_id', 'po_items_supplier_product_id_index');
            }

            // Used when resolving inventory for supplier variants
            if (!$this->indexExists('purchase_order_items', 'po_items_supplier_product_variant_id_index')) {
                $table->index('supplier_product_variant_id', 'po_items_supplier_product_variant_id_index');
            }

            // Used when filtering items by purchase order
            if (!$this->indexExists('purchase_order_items', 'po_items_purchase_order_id_index')) {
                $table->index('purchase_order_id', 'po_items_purchase_order_id_index');
            }
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            // Used in status-based lookups (e.g. WHERE status = 'supplier_delivered')
            if (!$this->indexExists('purchase_orders', 'purchase_orders_status_index')) {
                $table->index('status', 'purchase_orders_status_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropIndexIfExists('inventory_supplier_product_id_index');
            $table->dropIndexIfExists('inventory_supplier_product_variant_id_index');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropIndexIfExists('po_items_supplier_product_id_index');
            $table->dropIndexIfExists('po_items_supplier_product_variant_id_index');
            $table->dropIndexIfExists('po_items_purchase_order_id_index');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndexIfExists('purchase_orders_status_index');
        });
    }

    /**
     * Check whether an index already exists on a table (avoids duplicate-key errors
     * when running migrations on a database that was set up with a different schema).
     */
    private function indexExists(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();
        $dbName     = $connection->getDatabaseName();

        return (bool) $connection->selectOne(
            "SELECT 1 FROM information_schema.statistics
             WHERE table_schema = ? AND table_name = ? AND index_name = ?
             LIMIT 1",
            [$dbName, $table, $indexName]
        );
    }
}
