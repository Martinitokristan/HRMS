<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateProductSimilaritiesTable extends Migration
{
    public function up()
    {
        Schema::create('product_similarities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->foreignId('similar_product_id')->constrained('products')->onDelete('cascade');
            $table->decimal('score', 5, 4)->default(0);
            $table->enum('algorithm', ['collaborative', 'content', 'hybrid']);
            $table->timestamp('computed_at');

            $table->unique(['product_id', 'similar_product_id', 'algorithm'], 'prod_sim_unique');
            $table->index(['product_id', 'score']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('product_similarities');
    }
}
