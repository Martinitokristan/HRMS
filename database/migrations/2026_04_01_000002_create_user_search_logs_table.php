<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUserSearchLogsTable extends Migration
{
    public function up()
    {
        Schema::create('user_search_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('query', 255);
            $table->unsignedInteger('results_count')->default(0);
            $table->foreignId('clicked_product_id')->nullable()->constrained('products')->onDelete('set null');
            $table->timestamp('created_at')->nullable();

            $table->index(['user_id', 'created_at']);
            $table->index('query');
        });
    }

    public function down()
    {
        Schema::dropIfExists('user_search_logs');
    }
}
