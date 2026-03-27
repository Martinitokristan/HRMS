<?php
use App\Models\Inventory;
use App\Models\Product;

include 'vendor/autoload.php';
$app = include 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$barcode = '09876567';

echo "Checking Inventories for barcode: {$barcode}\n";

$invs = Inventory::with(['product', 'productVariant'])->where('product_id', 1)->get();

foreach ($invs as $inv) {
    echo "ID: " . $inv->id . 
         " | P_ID: " . ($inv->product_id ?? 'NULL') . 
         " | V_ID: " . ($inv->product_variant_id ?? 'NULL') . 
         " | Wh: " . $inv->warehouse_stock . 
         " | Name: " . ($inv->product ? $inv->product->name : 'N/A') . "\n";
}
