<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddSalePercentageToProductsAndVariants extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        // Add sale_percentage to products table
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('sale_percentage', 5, 2)->default(0)->after('sell_price');
        });

        // Add sale_percentage to product_variants table and change barcode_suffix to barcode
        Schema::table('product_variants', function (Blueprint $table) {
            $table->decimal('sale_percentage', 5, 2)->default(0)->after('price_override');
            $table->renameColumn('barcode_suffix', 'barcode');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        // Remove sale_percentage from products table
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('sale_percentage');
        });

        // Remove sale_percentage from product_variants table and rename barcode back to barcode_suffix
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('sale_percentage');
            $table->renameColumn('barcode', 'barcode_suffix');
        });
    }
}
