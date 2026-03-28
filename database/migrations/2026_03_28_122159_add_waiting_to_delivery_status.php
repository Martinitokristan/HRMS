<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddWaitingToDeliveryStatus extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        // Use DB statement to safely modify the ENUM column, adding 'waiting'
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE deliveries MODIFY COLUMN status ENUM('waiting', 'pending', 'confirmed', 'in_progress', 'delivered', 'failed') NOT NULL DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        // Revert it back (this might fail if there are records with 'waiting' still)
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE deliveries MODIFY COLUMN status ENUM('pending', 'confirmed', 'in_progress', 'delivered', 'failed') NOT NULL DEFAULT 'pending'");
    }
}
