<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $t) {
            if (!Schema::hasColumn('sales', 'was_confirmed_at')) {
                $t->timestamp('was_confirmed_at')->nullable()->after('status')->index();
            }
        });

        // Backfill: any sale that already passed the "confirmed" gate counts as sold.
        // - confirmed / out_for_delivery / delivered / returned: definitely was confirmed
        // - cancelled with a delivery row: rider had self-assigned, so it was confirmed before cancel
        DB::table('sales')
            ->whereIn('status', ['confirmed', 'out_for_delivery', 'delivered', 'returned'])
            ->whereNull('was_confirmed_at')
            ->update(['was_confirmed_at' => DB::raw('updated_at')]);

        DB::table('sales as s')
            ->join('deliveries as d', 'd.sale_id', '=', 's.id')
            ->where('s.status', 'cancelled')
            ->whereNull('s.was_confirmed_at')
            ->update(['s.was_confirmed_at' => DB::raw('s.updated_at')]);
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $t) {
            if (Schema::hasColumn('sales', 'was_confirmed_at')) {
                $t->dropColumn('was_confirmed_at');
            }
        });
    }
};
