<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddPayoutTrackingToDeliveries extends Migration
{
    /**
     * Wave 6 — rider payout / anti-fraud columns.
     * Each column is added in its own Schema::table closure so each ALTER
     * TABLE statement only references columns that already exist.
     * TiDB's DDL validator rejects `AFTER <col>` clauses that reference a
     * column being added in the same multi-column ALTER, so we split them
     * one-per-closure. Each step is guarded by Schema::hasColumn so the
     * migration is idempotent and safe to re-run.
     */
    public function up(): void
    {
        $cols = [
            ['delivery_fee',          function (Blueprint $t) { $t->decimal('delivery_fee', 10, 2)->default(0.00)->after('rating_comment'); }],
            ['cash_collected',        function (Blueprint $t) { $t->decimal('cash_collected', 10, 2)->default(0.00)->after('delivery_fee'); }],
            ['cash_remitted_at',      function (Blueprint $t) { $t->timestamp('cash_remitted_at')->nullable()->after('cash_collected'); }],
            ['cash_remitted_by',      function (Blueprint $t) { $t->unsignedBigInteger('cash_remitted_by')->nullable()->after('cash_remitted_at'); }],
            ['customer_confirmed_at', function (Blueprint $t) { $t->timestamp('customer_confirmed_at')->nullable()->after('cash_remitted_by'); }],
            ['customer_disputed_at',  function (Blueprint $t) { $t->timestamp('customer_disputed_at')->nullable()->after('customer_confirmed_at'); }],
            ['customer_dispute_reason', function (Blueprint $t) { $t->text('customer_dispute_reason')->nullable()->after('customer_disputed_at'); }],
            ['payout_status',         function (Blueprint $t) { $t->string('payout_status', 32)->default('pending')->after('customer_dispute_reason'); }],
            ['payout_eligible_at',    function (Blueprint $t) { $t->timestamp('payout_eligible_at')->nullable()->after('payout_status'); }],
            ['paid_at',               function (Blueprint $t) { $t->timestamp('paid_at')->nullable()->after('payout_eligible_at'); }],
            ['paid_by',               function (Blueprint $t) { $t->unsignedBigInteger('paid_by')->nullable()->after('paid_at'); }],
            ['mark_delivered_lat',    function (Blueprint $t) { $t->decimal('mark_delivered_lat', 10, 7)->nullable()->after('paid_by'); }],
            ['mark_delivered_lng',    function (Blueprint $t) { $t->decimal('mark_delivered_lng', 10, 7)->nullable()->after('mark_delivered_lat'); }],
            ['geofence_distance_m',   function (Blueprint $t) { $t->integer('geofence_distance_m')->nullable()->after('mark_delivered_lng'); }],
            ['geofence_flagged',      function (Blueprint $t) { $t->boolean('geofence_flagged')->default(false)->after('geofence_distance_m'); }],
        ];

        foreach ($cols as $entry) {
            [$name, $build] = $entry;
            if (!Schema::hasColumn('deliveries', $name)) {
                Schema::table('deliveries', function (Blueprint $t) use ($build) { $build($t); });
            }
        }

        // Indexes — idempotent via SHOW INDEX
        $this->ensureIndex('deliveries', 'deliveries_payout_status_index', 'payout_status');
        $this->ensureIndex('deliveries', 'deliveries_cash_remitted_at_index', 'cash_remitted_at');
        $this->ensureIndex('deliveries', 'deliveries_payout_status_paid_at_index', ['payout_status', 'paid_at']);

        // Seed the three control settings (idempotent: updateOrInsert).
        // Note: the `settings` table has no created_at/updated_at columns
        // (App\Models\Setting sets $timestamps = false), so do not include them.
        if (Schema::hasTable('settings')) {
            DB::table('settings')->updateOrInsert(
                ['key' => 'rider_default_delivery_fee'],
                ['value' => '30', 'group' => 'rider']
            );
            DB::table('settings')->updateOrInsert(
                ['key' => 'rider_geofence_flag_radius_m'],
                ['value' => '50', 'group' => 'rider']
            );
            DB::table('settings')->updateOrInsert(
                ['key' => 'rider_customer_confirm_window_hours'],
                ['value' => '24', 'group' => 'rider']
            );
        }
    }

    private function ensureIndex(string $table, string $name, $columns): void
    {
        $exists = collect(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$name]))->isNotEmpty();
        if ($exists) return;
        Schema::table($table, function (Blueprint $t) use ($name, $columns) {
            $t->index((array) $columns, $name);
        });
    }

    public function down(): void
    {
        foreach (['deliveries_payout_status_paid_at_index', 'deliveries_cash_remitted_at_index', 'deliveries_payout_status_index'] as $idx) {
            $exists = collect(DB::select("SHOW INDEX FROM `deliveries` WHERE Key_name = ?", [$idx]))->isNotEmpty();
            if ($exists) {
                Schema::table('deliveries', function (Blueprint $t) use ($idx) { $t->dropIndex($idx); });
            }
        }
        $cols = [
            'geofence_flagged','geofence_distance_m','mark_delivered_lng','mark_delivered_lat',
            'paid_by','paid_at','payout_eligible_at','payout_status',
            'customer_dispute_reason','customer_disputed_at','customer_confirmed_at',
            'cash_remitted_by','cash_remitted_at','cash_collected','delivery_fee',
        ];
        foreach ($cols as $c) {
            if (Schema::hasColumn('deliveries', $c)) {
                Schema::table('deliveries', function (Blueprint $t) use ($c) { $t->dropColumn($c); });
            }
        }
    }
}
