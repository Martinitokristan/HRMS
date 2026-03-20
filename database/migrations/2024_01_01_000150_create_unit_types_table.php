<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUnitTypesTable extends Migration
{
    public function up()
    {
        Schema::create('unit_types', function (Blueprint $table) {
            $table->id();
            $table->string('purchase_unit', 50);
            $table->string('sell_unit', 50);
            $table->decimal('multiplier', 10, 2)->default(1);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('unit_types');
    }
}
