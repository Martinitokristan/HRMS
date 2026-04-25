<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddRefundStatusToSales extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'refund_status')) {
                // none = no refund needed; pending_refund = approved cancellation, awaiting payout;
                // refunded = admin marked refunded; not_applicable = COD or unpaid GCash
                $table->string('refund_status', 32)->default('none')->after('payment_confirmed_at');
            }
            if (!Schema::hasColumn('sales', 'refunded_at')) {
                $table->timestamp('refunded_at')->nullable()->after('refund_status');
            }
            if (!Schema::hasColumn('sales', 'refunded_by')) {
                $table->unsignedBigInteger('refunded_by')->nullable()->after('refunded_at');
            }
        });

        // Idempotent index
        $exists = collect(\DB::select("SHOW INDEX FROM sales WHERE Key_name = 'sales_refund_status_index'"))->isNotEmpty();
        if (!$exists) {
            Schema::table('sales', function (Blueprint $table) {
                $table->index('refund_status', 'sales_refund_status_index');
            });
        }
    }

    public function down(): void
    {
        $exists = collect(\DB::select("SHOW INDEX FROM sales WHERE Key_name = 'sales_refund_status_index'"))->isNotEmpty();
        if ($exists) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropIndex('sales_refund_status_index');
            });
        }
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'refunded_by')) {
                $table->dropColumn('refunded_by');
            }
            if (Schema::hasColumn('sales', 'refunded_at')) {
                $table->dropColumn('refunded_at');
            }
            if (Schema::hasColumn('sales', 'refund_status')) {
                $table->dropColumn('refund_status');
            }
        });
    }
}
