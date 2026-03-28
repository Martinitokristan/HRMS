<?php
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SupplierProductVariant;
use App\Models\VariantValue;
use App\Models\Variant;

$products = Product::with('productVariants')->get();

foreach ($products as $product) {
    if ($product->productVariants->count() > 0) {
        echo "Product ID {$product->id} ({$product->name}): Barcode {$product->barcode}\n";
        
        foreach ($product->productVariants as $variant) {
            $updated = false;
            
            // Fix Barcode
            if ($variant->barcode !== $product->barcode) {
                echo "  - Updating variant ID {$variant->id} barcode from {$variant->barcode} to {$product->barcode}\n";
                $variant->barcode = $product->barcode;
                $updated = true;
            }
            
            // Fix Size/Color/Weight if null
            if ($variant->size_value_id === null || $variant->color_value_id === null || $variant->weight_value_id === null) {
                // Try to find matching SupplierProductVariant via inventory
                $inventory = \App\Models\Inventory::where('product_id', $product->id)
                    ->where('product_variant_id', $variant->id)
                    ->first();
                
                if ($inventory && $inventory->supplier_product_variant_id) {
                    $spv = SupplierProductVariant::find($inventory->supplier_product_variant_id);
                    if ($spv) {
                        echo "  - Found Supplier Product Variant ID {$spv->id} with size: '{$spv->size}', color: '{$spv->color}', weight: '{$spv->weight}'\n";
                        
                        // Size mapping
                        if ($variant->size_value_id === null && $spv->size) {
                            $sizeVariant = Variant::firstOrCreate(['name' => 'Size'], ['status' => 'active']);
                            $val = VariantValue::firstOrCreate(['variant_id' => $sizeVariant->id, 'label' => $spv->size], ['category' => 'size']);
                            $variant->size_value_id = $val->id;
                            $updated = true;
                            echo "    - Set size_value_id to {$val->id} ('{$spv->size}')\n";
                        }
                        
                        // Color mapping
                        if ($variant->color_value_id === null && $spv->color) {
                            $colorVariant = Variant::firstOrCreate(['name' => 'Color'], ['status' => 'active']);
                            $val = VariantValue::firstOrCreate(['variant_id' => $colorVariant->id, 'label' => $spv->color], ['category' => 'color']);
                            $variant->color_value_id = $val->id;
                            $updated = true;
                            echo "    - Set color_value_id to {$val->id} ('{$spv->color}')\n";
                        }
                        
                        // Weight mapping
                        if ($variant->weight_value_id === null && $spv->weight) {
                            $weightVariant = Variant::firstOrCreate(['name' => 'Weight'], ['status' => 'active']);
                            $val = VariantValue::firstOrCreate(['variant_id' => $weightVariant->id, 'label' => $spv->weight], ['category' => 'weight']);
                            $variant->weight_value_id = $val->id;
                            $updated = true;
                            echo "    - Set weight_value_id to {$val->id} ('{$spv->weight}')\n";
                        }
                    }
                }
            }
            
            if ($updated) {
                $variant->save();
            }
        }
    }
}
echo "Fix completed.\n";
