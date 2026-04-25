<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Wave 7 — pause / resume delivery tracking.
 *
 * TiDB-safe pattern: each new column is added in its own Schema::table closure
 * (TiDB rejects multi-column ALTER statements that chain AFTER clauses to
 * columns being added in the same statement). Each step is guarded by
 * Schema::hasColumn so the migration is idempotent and safe to re-run.
 */
return new class extends Migration {
    public function up(): void
    {
        $cols = [
            'paused_at'         => fn (Blueprint $t) => $t->timestamp('paused_at')->nullable()->after('delivered_at'),
            'pause_reason'      => fn (Blueprint $t) => $t->string('pause_reason', 255)->nullable()->after('paused_at'),
            'pause_resumes_at'  => fn (Blueprint $t) => $t->timestamp('pause_resumes_at')->nullable()->after('pause_reason'),
        ];

        foreach ($cols as $col => $add) {
            if (!Schema::hasColumn('deliveries', $col)) {
                Schema::table('deliveries', function (Blueprint $t) use ($add) { $add($t); });
            }
        }

        // Idempotent index using SHOW INDEX
        $indexes = collect(DB::select("SHOW INDEX FROM deliveries"))
            ->pluck('Key_name')->unique()->values()->all();
        if (!in_array('deliveries_paused_at_index', $indexes)) {
            Schema::table('deliveries', function (Blueprint $t) {
                $t->index('paused_at');
            });
        }
    }

    public function down(): void
    {
        $indexes = collect(DB::select("SHOW INDEX FROM deliveries"))
            ->pluck('Key_name')->unique()->values()->all();
        if (in_array('deliveries_paused_at_index', $indexes)) {
            Schema::table('deliveries', function (Blueprint $t) {
                $t->dropIndex('deliveries_paused_at_index');
            });
        }

        foreach (['pause_resumes_at', 'pause_reason', 'paused_at'] as $col) {
            if (Schema::hasColumn('deliveries', $col)) {
                Schema::table('deliveries', function (Blueprint $t) use ($col) { $t->dropColumn($col); });
            }
        }
    }
};
