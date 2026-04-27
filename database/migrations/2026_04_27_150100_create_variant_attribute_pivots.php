<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('product_variant_attributes')) {
            Schema::create('product_variant_attributes', function (Blueprint $t) {
                $t->id();
                $t->foreignId('product_variant_id')->constrained('product_variants', 'pva_pv_id')->onDelete('cascade');
                $t->foreignId('variant_id')->constrained('variants', 'pva_v_id')->onDelete('cascade');
                $t->foreignId('variant_value_id')->constrained('variant_values', 'pva_vv_id')->onDelete('cascade');
                $t->timestamps();
                $t->unique(['product_variant_id', 'variant_id'], 'pva_unique_per_type');
                $t->index('variant_id', 'pva_variant_idx');
                $t->index('variant_value_id', 'pva_value_idx');
            });
        }

        if (!Schema::hasTable('supplier_product_variant_attributes')) {
            Schema::create('supplier_product_variant_attributes', function (Blueprint $t) {
                $t->id();
                $t->foreignId('supplier_product_variant_id')->constrained('supplier_product_variants', 'spva_spv_id')->onDelete('cascade');
                $t->foreignId('variant_id')->constrained('variants', 'spva_v_id')->onDelete('cascade');
                $t->foreignId('variant_value_id')->constrained('variant_values', 'spva_vv_id')->onDelete('cascade');
                $t->timestamps();
                $t->unique(['supplier_product_variant_id', 'variant_id'], 'spva_unique_per_type');
                $t->index('variant_id', 'spva_variant_idx');
                $t->index('variant_value_id', 'spva_value_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_product_variant_attributes');
        Schema::dropIfExists('product_variant_attributes');
    }
};
