<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'cancellation_requested_at')) {
                $table->timestamp('cancellation_requested_at')
                    ->nullable()
                    ->after('cancellation_status');
            }

            if (!Schema::hasColumn('sales', 'cancellation_requested_by')) {
                $table->foreignId('cancellation_requested_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete()
                    ->after('cancellation_requested_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'cancellation_requested_by')) {
                $table->dropConstrainedForeignId('cancellation_requested_by');
            }
            if (Schema::hasColumn('sales', 'cancellation_requested_at')) {
                $table->dropColumn('cancellation_requested_at');
            }
        });
    }
};

