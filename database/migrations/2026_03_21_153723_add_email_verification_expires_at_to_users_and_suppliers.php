<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddEmailVerificationExpiresAtToUsersAndSuppliers extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('email_verification_expires_at')->nullable()->after('email_verification_token');
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->timestamp('email_verification_expires_at')->nullable()->after('email_verification_token');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('email_verification_expires_at');
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('email_verification_expires_at');
        });
    }
}
