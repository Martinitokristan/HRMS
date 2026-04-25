<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * NOTE: The audit prompt referenced `gcash_transactions.proof_token_used_at`,
 * but this codebase stores the proof token on the `sales` table
 * (`payment_proof_token`). We add the equivalent `payment_proof_token_used_at`
 * column to `sales` so the proof endpoints can detect already-used tokens
 * and respond with HTTP 410 instead of relying on token nulling.
 */
class AddProofTokenUsedAtToSales extends Migration
{
    public function up()
    {
        Schema::table('sales', function (Blueprint $table) {
            if (!Schema::hasColumn('sales', 'payment_proof_token_used_at')) {
                $table->timestamp('payment_proof_token_used_at')->nullable();
            }
        });
    }

    public function down()
    {
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'payment_proof_token_used_at')) {
                $table->dropColumn('payment_proof_token_used_at');
            }
        });
    }
}
