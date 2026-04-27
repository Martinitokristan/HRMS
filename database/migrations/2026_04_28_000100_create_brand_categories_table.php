<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('brand_categories', function (Blueprint $t) {
            $t->id();
            $t->foreignId('brand_id')->constrained('brands')->cascadeOnDelete();
            $t->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
            $t->timestamps();
            $t->unique(['brand_id', 'category_id']);
            $t->index('category_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_categories');
    }
};
