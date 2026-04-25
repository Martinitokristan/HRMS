<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddRefundStatusToSales extends Migration
{
    /**
     * Add refund tracking columns to the sales table.
     *
     * Each column is added in its own Schema::table closure so each
     * ALTER TABLE statement only references columns that already exist.
     * TiDB's DDL validator rejects `AFTER <col>` clauses that reference
     * a column being added in the same multi-column ALTER, so we split
     * them. Each step is guarded by Schema::hasColumn so the migration
     * is idempotent — safe to re-run after a partial failure.
     */
    public function up(): void
    {
        // Step 1: refund_status (lifecycle for refund tracking)
        if (!Schema::hasColumn('sales', 'refund_status')) {
            Schema::table('sales', function (Blueprint $table) {
                // none = no refund needed; pending_refund = approved cancellation, awaiting payout;
                // refunded = admin marked refunded; not_applicable = COD or unpaid GCash
                $table->string('refund_status', 32)
                      ->default('none')
                      ->after('payment_confirmed_at');
            });
        }

        // Step 2: refunded_at (timestamp of admin "Mark as Refunded")
        if (!Schema::hasColumn('sales', 'refunded_at')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->timestamp('refunded_at')
                      ->nullable()
                      ->after('refund_status');
            });
        }

        // Step 3: refunded_by (admin user id who marked the refund)
        if (!Schema::hasColumn('sales', 'refunded_by')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->unsignedBigInteger('refunded_by')
                      ->nullable()
                      ->after('refunded_at');
            });
        }

        // Step 4: index on refund_status, idempotent via SHOW INDEX
        $exists = collect(\DB::select("SHOW INDEX FROM sales WHERE Key_name = 'sales_refund_status_index'"))->isNotEmpty();
        if (!$exists && Schema::hasColumn('sales', 'refund_status')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->index('refund_status', 'sales_refund_status_index');
            });
        }
    }

    public function down(): void
    {
        // Drop index first (if present), then columns in reverse order.
        $exists = collect(\DB::select("SHOW INDEX FROM sales WHERE Key_name = 'sales_refund_status_index'"))->isNotEmpty();
        if ($exists) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropIndex('sales_refund_status_index');
            });
        }

        if (Schema::hasColumn('sales', 'refunded_by')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropColumn('refunded_by');
            });
        }

        if (Schema::hasColumn('sales', 'refunded_at')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropColumn('refunded_at');
            });
        }

        if (Schema::hasColumn('sales', 'refund_status')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropColumn('refund_status');
            });
        }
    }
}
