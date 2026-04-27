<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('category_variant_types')) {
            Schema::create('category_variant_types', function (Blueprint $t) {
                $t->id();
                $t->foreignId('category_id')->constrained('categories')->onDelete('cascade');
                $t->foreignId('variant_id')->constrained('variants')->onDelete('cascade');
                $t->boolean('is_required')->default(false);
                $t->unsignedSmallInteger('sort_order')->default(0);
                $t->timestamps();
                $t->unique(['category_id', 'variant_id'], 'cvt_unique_pair');
                $t->index('category_id', 'cvt_category_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('category_variant_types');
    }
};
