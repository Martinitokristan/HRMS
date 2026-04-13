<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddBrandIdToSupplierProducts extends Migration
{
    public function up()
    {
        Schema::table('supplier_products', function (Blueprint $table) {
            $table->foreignId('brand_id')->nullable()->after('category_id')
                  ->constrained('brands')->nullOnDelete();
        });
    }

    public function down()
    {
        Schema::table('supplier_products', function (Blueprint $table) {
            $table->dropForeign(['brand_id']);
            $table->dropColumn('brand_id');
        });
    }
}
