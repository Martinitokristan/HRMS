<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddAddressFieldsToSuppliersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (!Schema::hasColumn('suppliers', 'province')) {
                $table->string('province', 100)->nullable()->after('city');
            }
        });

        Schema::table('suppliers', function (Blueprint $table) {
            if (!Schema::hasColumn('suppliers', 'barangay')) {
                $table->string('barangay', 100)->nullable()->after('province');
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $columns = [];
            if (Schema::hasColumn('suppliers', 'barangay')) {
                $columns[] = 'barangay';
            }
            if (Schema::hasColumn('suppliers', 'province')) {
                $columns[] = 'province';
            }
            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
}