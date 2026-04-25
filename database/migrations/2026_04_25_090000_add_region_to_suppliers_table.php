<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddRegionToSuppliersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('suppliers', function (Blueprint $blueprint) {
            if (!Schema::hasColumn('suppliers', 'region')) {
                $blueprint->string('region', 100)->nullable()->after('barangay');
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
        Schema::table('suppliers', function (Blueprint $blueprint) {
            if (Schema::hasColumn('suppliers', 'region')) {
                $blueprint->dropColumn('region');
            }
        });
    }
}
