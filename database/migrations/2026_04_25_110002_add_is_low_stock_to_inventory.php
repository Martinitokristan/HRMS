<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddIsLowStockToInventory extends Migration
{
    public function up()
    {
        Schema::table('inventory', function (Blueprint $table) {
            if (!Schema::hasColumn('inventory', 'is_low_stock')) {
                $table->boolean('is_low_stock')->default(false)->after('reorder_threshold');
            }
        });

        // Backfill
        DB::statement('UPDATE inventory SET is_low_stock = (current_stock <= reorder_threshold)');

        // Add index (idempotent)
        $hasIndex = collect(DB::select("SHOW INDEX FROM inventory"))
            ->contains(fn ($i) => $i->Key_name === 'inventory_is_low_stock_index');
        if (!$hasIndex) {
            Schema::table('inventory', function (Blueprint $table) {
                $table->index('is_low_stock', 'inventory_is_low_stock_index');
            });
        }
    }

    public function down()
    {
        Schema::table('inventory', function (Blueprint $table) {
            $hasIndex = collect(DB::select("SHOW INDEX FROM inventory"))
                ->contains(fn ($i) => $i->Key_name === 'inventory_is_low_stock_index');
            if ($hasIndex) {
                $table->dropIndex('inventory_is_low_stock_index');
            }
            if (Schema::hasColumn('inventory', 'is_low_stock')) {
                $table->dropColumn('is_low_stock');
            }
        });
    }
}
