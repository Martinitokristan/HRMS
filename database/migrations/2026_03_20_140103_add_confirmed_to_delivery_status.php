<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddConfirmedToDeliveryStatus extends Migration
{
    public function up()
    {
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE deliveries MODIFY COLUMN status ENUM('pending', 'confirmed', 'in_progress', 'delivered', 'failed') NOT NULL DEFAULT 'pending'");
    }

    public function down()
    {
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE deliveries MODIFY COLUMN status ENUM('pending', 'in_progress', 'delivered', 'failed') NOT NULL DEFAULT 'pending'");
    }
}
