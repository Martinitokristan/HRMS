<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class NormalizePhoneNumbersToLocalFormat extends Migration
{
    /**
     * Convert legacy 12-digit "639XXXXXXXXX" phone values to the canonical
     * Philippine local format "09XXXXXXXXX" (11 digits) on three columns:
     *   - users.phone
     *   - suppliers.phone
     *   - sales.payment_phone_number
     *
     * Re-runnable: a row already in 09XXXXXXXXX form is left untouched.
     */
    public function up(): void
    {
        DB::statement("UPDATE users SET phone = CONCAT('0', SUBSTRING(phone, 3)) WHERE phone REGEXP '^63[0-9]{10}$'");
        DB::statement("UPDATE suppliers SET phone = CONCAT('0', SUBSTRING(phone, 3)) WHERE phone REGEXP '^63[0-9]{10}$'");
        DB::statement("UPDATE sales SET payment_phone_number = CONCAT('0', SUBSTRING(payment_phone_number, 3)) WHERE payment_phone_number REGEXP '^63[0-9]{10}$'");
    }

    /**
     * Best-effort rollback - convert 09XXXXXXXXX back to 639XXXXXXXXX.
     */
    public function down(): void
    {
        DB::statement("UPDATE users SET phone = CONCAT('63', SUBSTRING(phone, 2)) WHERE phone REGEXP '^09[0-9]{9}$'");
        DB::statement("UPDATE suppliers SET phone = CONCAT('63', SUBSTRING(phone, 2)) WHERE phone REGEXP '^09[0-9]{9}$'");
        DB::statement("UPDATE sales SET payment_phone_number = CONCAT('63', SUBSTRING(payment_phone_number, 2)) WHERE payment_phone_number REGEXP '^09[0-9]{9}$'");
    }
}
