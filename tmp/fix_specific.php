<?php
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SupplierProduct;
use App\Models\VariantValue;
use App\Models\Variant;

$variants = ProductVariant::where('product_id', 1)->get();

foreach ($variants as $variant) {
    if ($variant->size_value_id === null) {
        echo "Variant ID {$variant->id} for Product 1 has null size_value_id\n";
        
        // Find SupplierProduct variant with the same product ID
        $spv = \App\Models\SupplierProductVariant::whereHas('supplierProduct', function($q) {
            $q->where('id', 1);
        })->first();
        
        if ($spv && $spv->size) {
            echo "  - Found Supplier Variant size: '{$spv->size}'\n";
            $sizeVariant = Variant::firstOrCreate(['name' => 'Size'], ['status' => 'active', 'description' => 'Size variant']);
            $val = VariantValue::firstOrCreate(['variant_id' => $sizeVariant->id, 'label' => $spv->size], ['category' => 'size']);
            $variant->size_value_id = $val->id;
            $variant->save();
            echo "  - Updated variant ID {$variant->id} size_value_id to {$val->id} ('{$spv->size}')\n";
        }
    }
}
echo "Manual Fix completed.\n";
