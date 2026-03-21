<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddCurrentHeadingToRiderProfiles extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('rider_profiles', function (Blueprint $table) {
            $table->float('current_heading')->default(0)->after('current_longitude');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('rider_profiles', function (Blueprint $table) {
            $table->dropColumn('current_heading');
        });
    }
}
