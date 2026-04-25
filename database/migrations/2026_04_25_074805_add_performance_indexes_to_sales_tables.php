<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddPerformanceIndexesToSalesTables extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds composite and single-column indexes that dramatically speed up the
     * dashboard report queries in ReportController:
     *
     *  - sales(status, created_at)   → whereIn(status) + whereBetween(created_at)
     *  - sales(created_at)            → GROUP BY month / year range filters
     *  - sales(customer_id)           → JOIN to users for recent-activity feed
     *  - products(category_id)        → JOIN for yearly category revenue & return rate
     *
     * Note: sale_items(sale_id) and sale_items(product_id) are already indexed
     * automatically by MySQL because they are foreign keys.
     */
    public function up()
    {
        // ── sales table ────────────────────────────────────────────────────────
        Schema::table('sales', function (Blueprint $table) {
            // Composite: status filter + date range — the core of every report query
            if (!$this->indexExists('sales', 'sales_status_created_at_index')) {
                $table->index(['status', 'created_at'], 'sales_status_created_at_index');
            }
            // Single created_at — used independently for GROUP BY date/month/year
            if (!$this->indexExists('sales', 'sales_created_at_index')) {
                $table->index('created_at', 'sales_created_at_index');
            }
            // customer_id — used in JOIN for recent-activity and summary queries
            if (!$this->indexExists('sales', 'sales_customer_id_index')) {
                $table->index('customer_id', 'sales_customer_id_index');
            }
        });

        // ── products table ─────────────────────────────────────────────────────
        Schema::table('products', function (Blueprint $table) {
            // category_id — used in JOIN for yearly revenue + return rate charts
            if (!$this->indexExists('products', 'products_category_id_index')) {
                $table->index('category_id', 'products_category_id_index');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('sales', function (Blueprint $table) {
            if ($this->indexExists('sales', 'sales_status_created_at_index')) {
                $table->dropIndex('sales_status_created_at_index');
            }
            if ($this->indexExists('sales', 'sales_created_at_index')) {
                $table->dropIndex('sales_created_at_index');
            }
            if ($this->indexExists('sales', 'sales_customer_id_index')) {
                $table->dropIndex('sales_customer_id_index');
            }
        });

        Schema::table('products', function (Blueprint $table) {
            if ($this->indexExists('products', 'products_category_id_index')) {
                $table->dropIndex('products_category_id_index');
            }
        });
    }

    /**
     * Check whether a named index already exists on a table.
     * Prevents "Duplicate key name" errors when running on existing databases.
     */
    private function indexExists(string $table, string $indexName): bool
    {
        $indexes = DB::select(
            "SHOW INDEX FROM `{$table}` WHERE Key_name = ?",
            [$indexName]
        );
        return count($indexes) > 0;
    }
}
