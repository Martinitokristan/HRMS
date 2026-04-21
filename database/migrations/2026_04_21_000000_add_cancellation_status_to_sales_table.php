<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('sales', 'cancellation_status')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->enum('cancellation_status', ['pending', 'approved', 'rejected'])
                    ->nullable()
                    ->after('cancellation_notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('sales', 'cancellation_status')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropColumn('cancellation_status');
            });
        }
    }
};