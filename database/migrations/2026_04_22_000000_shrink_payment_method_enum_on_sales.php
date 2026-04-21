<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('sales')
            ->whereNotIn('payment_method', ['cod', 'gcash'])
            ->update(['payment_method' => 'cod']);

        // Use raw SQL to avoid requiring doctrine/dbal for enum changes.
        DB::statement("ALTER TABLE `sales` MODIFY `payment_method` ENUM('cod','gcash') NOT NULL");
    }

    public function down(): void
    {
        // Restore the previous enum values (legacy).
        DB::statement("ALTER TABLE `sales` MODIFY `payment_method` ENUM('cod','gcash','bank_transfer') NOT NULL");
    }
};

