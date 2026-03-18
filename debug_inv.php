<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Product;
use App\Models\Inventory;

echo "=== PRODUCTS ===\n";
$products = Product::with('productVariants')->get();
if ($products->isEmpty()) {
    echo "No products found.\n";
} else {
    foreach ($products as $p) {
        $invs = Inventory::where('product_id', $p->id)->get();
        echo "Product: {$p->name} (id={$p->id}) variants={$p->productVariants->count()}\n";
        foreach ($invs as $i) {
            echo "  inv_id={$i->id} product_variant_id=" . ($i->product_variant_id ?? 'NULL') 
               . " warehouse={$i->warehouse_stock} current={$i->current_stock}\n";
        }
        if ($invs->isEmpty()) echo "  (no inventory rows)\n";
    }
}

echo "\n=== ALL INVENTORY ROWS ===\n";
$allInv = Inventory::all();
foreach ($allInv as $i) {
    echo "inv_id={$i->id}"
       . " product_id=" . ($i->product_id ?? 'NULL')
       . " product_variant_id=" . ($i->product_variant_id ?? 'NULL')
       . " supplier_product_id=" . ($i->supplier_product_id ?? 'NULL')
       . " supplier_product_variant_id=" . ($i->supplier_product_variant_id ?? 'NULL')
       . " warehouse={$i->warehouse_stock} current={$i->current_stock}\n";
}

echo "\n=== SUPPLIER PRODUCTS + VARIANTS ===\n";
$sps = \App\Models\SupplierProduct::with('variants')->get();
foreach ($sps as $sp) {
    echo "sp_id={$sp->id} name={$sp->name} price={$sp->price} stock={$sp->stock}\n";
    foreach ($sp->variants as $sv) {
        echo "  sv_id={$sv->id} size={$sv->size} color={$sv->color} stock={$sv->stock} price_override={$sv->price_override}\n";
    }
}
