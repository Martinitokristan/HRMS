<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Jobs\ProcessProductBannerImage;
use App\Models\PurchaseOrder;
use App\Models\POItem;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SupplierProduct;
use App\Models\User;
use App\Notifications\PurchaseOrderRequest;
use App\Notifications\PurchaseOrderAccepted;
use App\Notifications\PurchaseOrderDelivered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.supplierProduct'])
            ->when($request->tab, function ($q) use ($request) {
                if ($request->tab === 'requests') {
                    return $q->whereIn('status', ['pending', 'pending_supplier', 'accepted']);
                } elseif ($request->tab === 'completed') {
                    return $q->whereIn('status', ['supplier_delivered', 'received', 'rejected', 'cancelled']);
                }
            })
            ->when($request->status, function ($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function ($q) use ($request) {
                return $q->where('po_number', 'like', "%{$request->search}%");
            })
            ->latest();

        return response()->json([
            'data' => $query->paginate($request->get('per_page', 15)),
            'status' => 'success',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.supplier_product_id' => 'nullable|exists:supplier_products,id',
            'items.*.supplier_product_variant_id' => 'nullable|exists:supplier_product_variants,id',
            'items.*.quantity' => 'required|numeric|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'expected_date' => 'nullable|date',
        ]);

        $po = DB::transaction(function () use ($data, $request) {
            $total = 0;
            $po = PurchaseOrder::create([
                'po_number' => 'PO-' . str_pad(PurchaseOrder::count() + 1, 4, '0', STR_PAD_LEFT),
                'supplier_id' => $data['supplier_id'],
                'created_by' => $request->user()->id,
                'is_auto' => false,
                'status' => 'pending',
                'expected_date' => $data['expected_date'] ?? null,
                'total_cost' => 0,
            ]);

            foreach ($data['items'] as $item) {
                $subtotal = $item['quantity'] * $item['unit_cost'];
                $total += $subtotal;
                POItem::create([
                    'purchase_order_id' => $po->id,
                    'product_id' => $item['product_id'] ?? null,
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'supplier_product_id' => $item['supplier_product_id'] ?? null,
                    'supplier_product_variant_id' => $item['supplier_product_variant_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'subtotal' => $subtotal,
                ]);

                // CRITICAL FIX: Reserve/decrease supplier stock when admin ORDERS
                if (!empty($item['supplier_product_id'])) {
                    $supplierProduct = \App\Models\SupplierProduct::with('variants')->find($item['supplier_product_id']);
                    if ($supplierProduct) {
                        if (!empty($item['supplier_product_variant_id'])) {
                            // PATH A: Decrease specific variant stock (variant's own stock, independent of base)
                            $supplierVariant = \App\Models\SupplierProductVariant::find($item['supplier_product_variant_id']);
                            if (!$supplierVariant) {
                                throw new \Exception("Variant not found.");
                            }
                            if ($supplierVariant->stock < $item['quantity']) {
                                throw new \Exception("Insufficient stock for variant '{$supplierVariant->size}{$supplierVariant->color}{$supplierVariant->weight}'. Available: {$supplierVariant->stock}, Requested: {$item['quantity']}");
                            }
                            $supplierVariant->decrement('stock', $item['quantity']);
                            // NOTE: We do NOT sync total_stock here — base stock is independent from variant stocks.
                        } else {
                            // PATH B: No variant selected = ordering the Regular/base product
                            // Deduct from total_stock (the base product's own stock)
                            if ($supplierProduct->total_stock < $item['quantity']) {
                                throw new \Exception("Insufficient stock for '{$supplierProduct->name}' (Regular). Available: {$supplierProduct->total_stock}, Requested: {$item['quantity']}");
                            }
                            $supplierProduct->decrement('total_stock', $item['quantity']);
                        }
                    }
                }
            }

            $po->update(['total_cost' => $total]);
            return $po;
        });

        // Notification moved to approve() method

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.created'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.created'));

        return response()->json([
            'data' => $po->load(['supplier', 'items.product', 'items.supplierProduct']),
            'message' => 'Order request sent successfully',
            'status' => 'success',
        ], 201);
    }

    public function show($id)
    {
        $po = PurchaseOrder::with([
            'supplier',
            'creator',
            'items.product',
            'items.supplierProduct',
            'items.productVariant.sizeValue',
            'items.productVariant.colorValue',
            'items.productVariant.weightValue',
        ])->findOrFail($id);
        return response()->json(['data' => $po, 'status' => 'success']);
    }

    public function approve($id)
    {
        $po = PurchaseOrder::findOrFail($id);

        if ($po->status !== 'pending') {
            return response()->json(['message' => 'Only pending POs can be approved.', 'status' => 'error'], 422);
        }

        $po->update(['status' => 'pending_supplier']);

        // Notify Supplier
        $po->load(['supplier', 'items.product', 'items.supplierProduct']);
        if ($po->supplier) {
            $po->supplier->notify(new \App\Notifications\PurchaseOrderRequest($po));
        }

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.approved'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_notifications', 'supplier_products'], 'purchase_order.approved'));

        return response()->json([
            'data' => $po,
            'message' => 'Purchase order approved and sent to supplier.',
            'status' => 'success',
        ]);
    }

    public function decline($id)
    {
        $po = PurchaseOrder::with('items')->findOrFail($id);

        if ($po->status !== 'pending') {
            return response()->json(['message' => 'Only pending POs can be declined.', 'status' => 'error'], 422);
        }

        DB::transaction(function () use ($po) {
            // CRITICAL FIX: Restore supplier stock when admin cancels order
            foreach ($po->items as $item) {
                if ($item->supplier_product_id) {
                    $supplierProduct = \App\Models\SupplierProduct::find($item->supplier_product_id);
                    if ($supplierProduct) {
                        if ($item->supplier_product_variant_id) {
                            // Restore variant stock
                            $supplierVariant = \App\Models\SupplierProductVariant::find($item->supplier_product_variant_id);
                            if ($supplierVariant) {
                                $supplierVariant->increment('stock', $item->quantity);

                                // Sync total_stock
                                $totalVariantStock = \App\Models\SupplierProductVariant::where('supplier_product_id', $supplierProduct->id)->sum('stock');
                                $supplierProduct->update(['total_stock' => $totalVariantStock]);
                            }
                        } else {
                            // Restore base product stock
                            $supplierProduct->increment('total_stock', $item->quantity);
                        }
                    }
                }
            }

            $po->update(['status' => 'cancelled']);
        });

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.declined'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.declined'));

        return response()->json([
            'data' => $po,
            'message' => 'Purchase order has been declined. Stock has been restored.',
            'status' => 'success',
        ]);
    }

    public function accept($id)
    {
        $supplierId = $this->resolveSupplierID(request());

        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'pending_supplier')
            ->findOrFail($id);

        $po->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        // Notify Admin(s)
        $admins = User::where('role', 'admin')->get();
        Notification::send($admins, new PurchaseOrderAccepted($po));

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.accepted'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.accepted'));

        return response()->json([
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order accepted. Awaiting delivery confirmation.',
            'status' => 'success',
        ]);
    }

    public function reject($id)
    {
        $supplierId = $this->resolveSupplierID(request());

        $data = request()->validate([
            'rejection_reason' => 'required|string|min:10|max:1000',
        ]);

        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'pending_supplier')
            ->findOrFail($id);

        DB::transaction(function () use ($po, $data) {
            // CRITICAL FIX: Restore supplier stock when order is rejected
            foreach ($po->items as $item) {
                if ($item->supplier_product_id) {
                    $supplierProduct = \App\Models\SupplierProduct::find($item->supplier_product_id);
                    if ($supplierProduct) {
                        if ($item->supplier_product_variant_id) {
                            // Restore variant stock
                            $supplierVariant = \App\Models\SupplierProductVariant::find($item->supplier_product_variant_id);
                            if ($supplierVariant) {
                                $supplierVariant->increment('stock', $item->quantity);

                                // Sync total_stock
                                $totalVariantStock = \App\Models\SupplierProductVariant::where('supplier_product_id', $supplierProduct->id)->sum('stock');
                                $supplierProduct->update(['total_stock' => $totalVariantStock]);
                            }
                        } else {
                            // Restore base product stock
                            $supplierProduct->increment('total_stock', $item->quantity);
                        }
                    }
                }
            }

            $po->update([
                'status' => 'rejected',
                'rejection_reason' => $data['rejection_reason'],
            ]);
        });

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.rejected'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.rejected'));

        return response()->json([
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order rejected. Stock has been restored.',
            'status' => 'success',
        ]);
    }

    public function markReceived($id)
    {
        // Helper function to generate truly unique barcodes
        $generateUniqueBarcode = function ($prefix = 'BARCODE-') {
            do {
                $barcode = $prefix . strtoupper(\Illuminate\Support\Str::random(10));
                $exists = \App\Models\Product::where('barcode', $barcode)->exists() ||
                    \App\Models\ProductVariant::where('barcode', $barcode)->exists();
            } while ($exists);

            return $barcode;
        };

        $po = PurchaseOrder::with('items')->findOrFail($id);

        if ($po->status !== 'supplier_delivered') {
            return response()->json([
                'message' => 'Only delivered POs can be marked as received.',
                'status' => 'error',
            ], 422);
        }

        DB::transaction(function () use ($po, $generateUniqueBarcode) {
            foreach ($po->items as $item) {
                $inv = null;

                // DEBUG: Log what we're working with
                \Log::info('Processing PO Item:', [
                    'product_id' => $item->product_id,
                    'product_variant_id' => $item->product_variant_id,
                    'supplier_product_id' => $item->supplier_product_id,
                    'supplier_product_variant_id' => $item->supplier_product_variant_id,
                    'quantity' => $item->quantity,
                    'product_name' => $item->product ? $item->product->name : 'N/A',
                    'variant_info' => $item->productVariant ? $item->productVariant->size_value . $item->productVariant->color_value . $item->productVariant->weight_value : 'Base Product'
                ]);

                // CACHE: Share created/found products across items in the same PO
                static $productLocalCache = [];
                $supplierProductId = $item->supplier_product_id;

                // FIXED: Improved lookup logic with proper base vs variant distinction

                // CASE 1: For BASE PRODUCTS (both product_variant_id and supplier_product_variant_id are null)
                if (is_null($item->product_variant_id) && is_null($item->supplier_product_variant_id)) {
                    \Log::info('Looking for BASE PRODUCT inventory', []);

                    // Look for base product inventory (product_variant_id must be null)
                    $inv = Inventory::where('product_id', $item->product_id)
                        ->whereNull('product_variant_id')
                        ->first();

                    \Log::info('Base product inventory found', $inv ? ['id' => $inv->id, 'warehouse_stock' => $inv->warehouse_stock] : ['result' => 'No']);
                }
                // CASE 2: For VARIANTS (either product_variant_id or supplier_product_variant_id is not null)
                else {
                    \Log::info('Looking for VARIANT inventory', [
                        'product_variant_id' => $item->product_variant_id,
                        'supplier_product_variant_id' => $item->supplier_product_variant_id
                    ]);

                    // First try to find by product_variant_id if it exists
                    if (!is_null($item->product_variant_id)) {
                        $inv = Inventory::where('product_id', $item->product_id)
                            ->where('product_variant_id', $item->product_variant_id)
                            ->first();

                        \Log::info('Variant inventory found by product_variant_id', $inv ? ['id' => $inv->id, 'warehouse_stock' => $inv->warehouse_stock] : ['result' => 'No']);
                    }

                    // If not found, try by supplier_product_variant_id
                    if (!$inv && !is_null($item->supplier_product_variant_id)) {
                        $inv = Inventory::where('supplier_product_variant_id', $item->supplier_product_variant_id)->first();

                        \Log::info('Variant inventory found by supplier_product_variant_id', $inv ? ['id' => $inv->id, 'warehouse_stock' => $inv->warehouse_stock] : ['result' => 'No']);
                    }
                }

                // CASE 3: If no inventory found via product, check by supplier references
                if (!$inv && $item->supplier_product_variant_id) {
                    \Log::info('Checking by supplier variant', []);
                    $inv = Inventory::where('supplier_product_variant_id', $item->supplier_product_variant_id)->first();
                    \Log::info('Supplier variant check result', $inv ? ['found' => true, 'id' => $inv->id] : ['found' => false]);
                }

                if (!$inv && $item->supplier_product_id) {
                    \Log::info('Checking by supplier product', []);
                    if (is_null($item->product_variant_id) && is_null($item->supplier_product_variant_id)) {
                        // Only look for base product if this is actually a base product
                        $inv = Inventory::where('supplier_product_id', $item->supplier_product_id)
                            ->whereNull('supplier_product_variant_id')
                            ->first();
                    } else {
                        // For variants, don't fall back to base product inventory
                        \Log::info('Skipping base product lookup for variant', []);
                    }
                    \Log::info('Supplier product check result', $inv ? ['found' => true, 'id' => $inv->id] : ['found' => false]);
                }

                // CASE 3.5: For supplier variants, always create separate inventory if not found
                \Log::info('Before inventory creation check', [
                    'inv_exists' => $inv ? true : false,
                    'supplier_product_variant_id' => $item->supplier_product_variant_id,
                    'inv_id' => $inv ? $inv->id : null
                ]);

                if (!$inv && $item->supplier_product_variant_id) {
                    \Log::info('Creating inventory for supplier variant', [
                        'supplier_product_variant_id' => $item->supplier_product_variant_id,
                        'product_id' => $item->product_id,
                        'product_variant_id' => $item->product_variant_id
                    ]);

                    // First, find or create the product variant if it doesn't exist
                    $productVariantId = $item->product_variant_id;
                    $currentProductId = $item->product_id ?: (isset($productLocalCache[$supplierProductId]) ? $productLocalCache[$supplierProductId] : null);

                    if (!$productVariantId && $item->supplier_product_variant_id && $currentProductId) {
                        $spVariant = \App\Models\SupplierProductVariant::find($item->supplier_product_variant_id);
                        if ($spVariant) {
                            // Look for existing product variant via relationships since string columns don't exist
                            $existingVariant = \App\Models\ProductVariant::where('product_id', $currentProductId)
                                ->where(function ($q) use ($spVariant) {
                                    if ($spVariant->size) {
                                        $q->whereHas('sizeValue', fn($sq) => $sq->where('label', $spVariant->size));
                                    } else {
                                        $q->whereNull('size_value_id');
                                    }
                                })
                                ->where(function ($q) use ($spVariant) {
                                    if ($spVariant->color) {
                                        $q->whereHas('colorValue', fn($sq) => $sq->where('label', $spVariant->color));
                                    } else {
                                        $q->whereNull('color_value_id');
                                    }
                                })
                                ->where(function ($q) use ($spVariant) {
                                    if ($spVariant->weight) {
                                        $q->whereHas('weightValue', fn($sq) => $sq->where('label', $spVariant->weight));
                                    } else {
                                        $q->whereNull('weight_value_id');
                                    }
                                })
                                ->first();

                            if ($existingVariant) {
                                $productVariantId = $existingVariant->id;
                                \Log::info('Found existing product variant', ['variant_id' => $productVariantId]);
                            } else {
                                \Log::info('No existing product variant found, will create later in Case 4');
                            }
                        }
                    }

                    // Check if inventory record already exists for this variant (double-check)
                    $existingInv = null;
                    if ($productVariantId && $currentProductId) {
                        $existingInv = Inventory::where('product_id', $currentProductId)
                            ->where('product_variant_id', $productVariantId)
                            ->first();
                    }

                    if (!$existingInv && $item->supplier_product_variant_id) {
                        $existingInv = Inventory::where('supplier_product_variant_id', $item->supplier_product_variant_id)
                            ->first();
                    }

                    if ($existingInv) {
                        \Log::info('Found existing variant inventory record, using it', ['inventory_id' => $existingInv->id]);
                        $inv = $existingInv;
                        // Ensure it's linked to the correct product if it was an orphan
                        if (!$inv->product_id && $currentProductId) {
                            $inv->product_id = $currentProductId;
                            if ($productVariantId) {
                                $inv->product_variant_id = $productVariantId;
                            }
                            $inv->save();
                            \Log::info('Linked orphan inventory to existing product', ['product_id' => $currentProductId]);
                        }
                    } else {
                        \Log::info('Creating new variant inventory record');
                        $inv = Inventory::create([
                            'product_id' => $currentProductId,
                            'product_variant_id' => $productVariantId,
                            'supplier_product_id' => $item->supplier_product_id,
                            'supplier_product_variant_id' => $item->supplier_product_variant_id,
                            'current_stock' => 0,
                            'warehouse_stock' => 0,
                            'reorder_threshold' => 10,
                        ]);
                        \Log::info('Created supplier variant inventory', ['inventory_id' => $inv->id]);
                    }
                }

                // CASE 4: Create products from supplier data if they don't exist
                if (!$inv || (is_null($inv->product_id) && $item->supplier_product_id)) {
                    \Log::info('Creating or finding product from supplier data', []);

                    $productId = $item->product_id ?: (isset($productLocalCache[$supplierProductId]) ? $productLocalCache[$supplierProductId] : null);
                    if (!$productId && $item->supplier_product_id) {
                        // Check if a product already exists for this supplier product globally
                        $existingProd = Product::whereHas('inventory', function ($q) use ($item) {
                            $q->where('supplier_product_id', $item->supplier_product_id);
                        })->first();

                        if ($existingProd) {
                            $productId = $existingProd->id;
                            $productLocalCache[$supplierProductId] = $productId;
                            \Log::info('Found existing linked product', ['product_id' => $productId]);
                        }
                    }

                    $variantId = $item->product_variant_id;

                    // If we have supplier product but no product, create the product
                    if (!$productId && $item->supplier_product_id) {
                        \Log::info('Creating new product from supplier product', []);
                        $supplierProduct = SupplierProduct::find($item->supplier_product_id);

                        if ($supplierProduct) {
                            $newProduct = Product::updateOrCreate(
                                ['barcode' => !empty($supplierProduct->barcode) && $supplierProduct->barcode !== 'undefined' ? $supplierProduct->barcode : $generateUniqueBarcode()],
                                [
                                    'name' => $supplierProduct->name,
                                    'description' => $supplierProduct->description,
                                    'category_id' => $supplierProduct->category_id,
                                    'brand_id' => $supplierProduct->brand_id,
                                    'unit_type_id' => 1, // Default unit type
                                    'supplier_id' => $supplierProduct->supplier_id ?? 1,
                                    'purchase_price' => $supplierProduct->price,
                                    'sell_price' => $supplierProduct->price * 1.3, // 30% markup
                                    'image_path' => $supplierProduct->image_path, // Copy image from supplier
                                    'is_active' => 0, // Inactive until explicitly displayed to storefront
                                ]
                            );
                            $productId = $newProduct->id;
                            $productLocalCache[$supplierProductId] = $productId;
                            \Log::info('Created new product', ['product_id' => $productId, 'name' => $newProduct->name]);

                            if (!empty($newProduct->image_path) && empty($newProduct->image_banner_path)) {
                                ProcessProductBannerImage::dispatch($newProduct->id, $newProduct->image_path);
                            }
                        }
                    }

                    // If we have supplier variant but no variant, create the variant
                    if (!$variantId && $item->supplier_product_variant_id && $productId) {
                        \Log::info('Creating new variant from supplier variant', []);
                        $supplierVariant = \App\Models\SupplierProductVariant::find($item->supplier_product_variant_id);

                        if ($supplierVariant) {
                            // Find or create appropriate variant values
                            $sizeValueId = null;
                            $colorValueId = null;
                            $weightValueId = null;

                            // Handle size value - extract from supplier variant if possible
                            if ($supplierVariant->size) {
                                $existing = DB::table('variant_values')->where('label', $supplierVariant->size)->where('category', 'size')->first();
                                $sizeValueId = $existing ? $existing->id : DB::table('variant_values')->insertGetId([
                                    'variant_id' => 1,
                                    'label' => $supplierVariant->size,
                                    'category' => 'size',
                                    'created_at' => now(),
                                    'updated_at' => now(),
                                ]);
                            }

                            // Handle color value
                            if ($supplierVariant->color) {
                                $existing = DB::table('variant_values')->where('label', $supplierVariant->color)->where('category', 'color')->first();
                                $colorValueId = $existing ? $existing->id : DB::table('variant_values')->insertGetId([
                                    'variant_id' => 2,
                                    'label' => $supplierVariant->color,
                                    'category' => 'color',
                                    'created_at' => now(),
                                    'updated_at' => now(),
                                ]);
                            }

                            // Handle weight value
                            if ($supplierVariant->weight) {
                                $existing = DB::table('variant_values')->where('label', $supplierVariant->weight)->where('category', 'weight')->first();
                                $weightValueId = $existing ? $existing->id : DB::table('variant_values')->insertGetId([
                                    'variant_id' => 3,
                                    'label' => $supplierVariant->weight,
                                    'category' => 'weight',
                                    'created_at' => now(),
                                    'updated_at' => now(),
                                ]);
                            }

                            $newVariant = ProductVariant::create([
                                'product_id' => $productId,
                                'size_value_id' => $sizeValueId,
                                'color_value_id' => $colorValueId,
                                'weight_value_id' => $weightValueId,
                                'stock' => 0,
                                'price_override' => $supplierVariant->price_override,
                                'barcode' => $generateUniqueBarcode('VAR-'), // Generate unique barcode for variant
                                'sale_percentage' => 0,
                                'image_path' => $supplierVariant->image_path,
                                'additional_images' => $supplierVariant->additional_images, // Copy additional images
                            ]);
                            $variantId = $newVariant->id;
                            \Log::info('Created new variant', ['variant_id' => $variantId, 'product_id' => $productId]);
                        }
                    }

                    if ($inv) {
                        // Link existing inventory to found/created product
                        $inv->product_id = $productId;
                        if ($variantId) {
                            $inv->product_variant_id = $variantId;
                        }
                        $inv->save();
                        \Log::info('Linked existing inventory to product/variant', ['inv_id' => $inv->id, 'product_id' => $productId]);
                    } else {
                        // Now create the inventory record with the proper IDs
                        \Log::info('Creating new inventory record', []);
                        $inv = Inventory::create([
                            'product_id' => $productId,
                            'product_variant_id' => $variantId,
                            'supplier_product_id' => $item->supplier_product_id,
                            'supplier_product_variant_id' => $item->supplier_product_variant_id,
                            'current_stock' => 0,
                            'warehouse_stock' => 0,
                            'reorder_threshold' => 10,
                        ]);
                    }

                    // Update the PO item to reference the newly created product/variant
                    $item->update([
                        'product_id' => $productId,
                        'product_variant_id' => $variantId,
                    ]);
                    \Log::info('Updated PO item with new product/variant IDs', []);
                }

                // Update warehouse stock
                $oldStock = $inv->warehouse_stock;
                $inv->increment('warehouse_stock', $item->quantity);
                $inv->last_adjusted_at = now();
                $inv->save();

                \Log::info('Stock updated:', [
                    'inventory_id' => $inv->id,
                    'old_stock' => $oldStock,
                    'added_quantity' => $item->quantity,
                    'new_stock' => $inv->warehouse_stock,
                    'is_base_product' => is_null($item->product_variant_id)
                ]);

                // Base products and variants should maintain separate stock management
                // They both go to the warehouse first and require a manual 'Transfer' to store.
            }

            // REMOVED: Don't automatically sync base product stock with variants
            // Base products and variants should maintain separate stock management
            // This prevents incorrect stock merging in the inventory display
            $po->update(['status' => 'received']);
        });

        if (Cache::getStore() instanceof \Illuminate\Cache\TaggableStore)
            Cache::tags(['inventory', 'products'])->flush();

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_inventory', 'admin_dashboard', 'supplier_products'], 'purchase_order.received'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.received'));

        return response()->json([
            'data' => $po->fresh()->load(['supplier', 'items.product', 'items.productVariant']),
            'message' => 'Purchase order received. Stock added to Warehouse inventory.',
            'status' => 'success',
        ]);
    }

    // Supplier-specific methods

    /**
     * Resolve the suppliers.id for the currently authenticated user.
     * Supplier users log in via the shared /api/login endpoint (users table),
     * but purchase_orders.supplier_id references suppliers.id.
     * The two tables are linked by email.
     */
    private function resolveSupplierID(Request $request): int
    {
        $user = $request->user();
        // If authenticated as Supplier model directly (token auth), use id as-is
        if ($user instanceof \App\Models\Supplier) {
            return $user->id;
        }
        // Otherwise authenticated as User model — find linked Supplier by email
        $supplier = \App\Models\Supplier::where('email', $user->email)->first();
        if (!$supplier) {
            abort(403, 'No supplier account linked to this user.');
        }
        return $supplier->id;
    }

    public function supplierIndex(Request $request)
    {
        try {
            $supplier = $request->user();

            \Log::info('SupplierIndex: Building query', ['supplier_id' => $supplier->id]);

            $supplierId = $this->resolveSupplierID($request);

            $query = PurchaseOrder::with(['supplier', 'creator', 'items.product', 'items.supplierProduct'])
                ->where('supplier_id', $supplierId)
                ->when($request->tab, function ($q) use ($request) {
                    if ($request->tab === 'requests') {
                        return $q->whereIn('status', ['pending_supplier', 'accepted']);
                    } elseif ($request->tab === 'completed') {
                        return $q->whereIn('status', ['supplier_delivered', 'received', 'rejected', 'cancelled']);
                    }
                })
                ->when($request->status, function ($q) use ($request) {
                    return $q->where('status', $request->status);
                })
                ->latest();

            \Log::info('SupplierIndex: Executing query', []);
            $result = $query->paginate($request->get('per_page', 15));
            \Log::info('SupplierIndex: Query successful', ['count' => $result->count()]);

            return response()->json([
                'data' => $result,
                'status' => 'success',
            ]);
        } catch (\Exception $e) {
            \Log::error('SupplierIndex error', ['message' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine(), 'trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => 'Server error: ' . $e->getMessage(),
                'status' => 'error'
            ], 500);
        }
    }

    public function supplierShow($id)
    {
        $supplierId = $this->resolveSupplierID(request());

        $po = PurchaseOrder::with(['supplier', 'creator', 'items.product'])
            ->where('supplier_id', $supplierId)
            ->findOrFail($id);

        return response()->json(['data' => $po, 'status' => 'success']);
    }

    public function deliver($id)
    {
        $supplierId = $this->resolveSupplierID(request());

        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'accepted')
            ->findOrFail($id);

        $data = request()->validate([
            'delivery_notes' => 'nullable|string|max:500',
        ]);

        $po->update([
            'status' => 'supplier_delivered',
            'delivered_at' => now(),
            'delivered_by' => $supplierId,
            'delivery_notes' => $data['delivery_notes'] ?? null,
        ]);

        // Notify Admin(s)
        $admins = \App\Models\User::where('role', 'admin')->get();
        \Illuminate\Support\Facades\Notification::send($admins, new \App\Notifications\PurchaseOrderDelivered($po));

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'admin_notifications'], 'purchase_order.delivered'));
        broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_orders', 'supplier_dashboard'], 'purchase_order.delivered'));

        return response()->json([
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'message' => 'Purchase order marked as delivered',
            'status' => 'success',
        ]);
    }
}
