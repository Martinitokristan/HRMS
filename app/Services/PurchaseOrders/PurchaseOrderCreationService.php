<?php

namespace App\Services\PurchaseOrders;

use App\Models\PurchaseOrder;
use App\Models\POItem;
use App\Models\SupplierProduct;
use App\Models\SupplierProductVariant;
use App\Events\DataMutated;
use DB;

class PurchaseOrderCreationService
{
    /**
     * Create new purchase order with stock deduction.
     */
    public function create($data, $userId)
    {
        $po = DB::transaction(function () use ($data, $userId) {
            $total = 0;
            $po = PurchaseOrder::create([
                'po_number' => 'PO-' . str_pad(PurchaseOrder::count() + 1, 4, '0', STR_PAD_LEFT),
                'supplier_id' => $data['supplier_id'],
                'created_by' => $userId,
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

                if (!empty($item['supplier_product_id'])) {
                    $supplierProduct = SupplierProduct::with('variants')->find($item['supplier_product_id']);
                    if ($supplierProduct) {
                        if (!empty($item['supplier_product_variant_id'])) {
                            $supplierVariant = SupplierProductVariant::find($item['supplier_product_variant_id']);
                            if (!$supplierVariant) {
                                throw new \Exception("Variant not found.");
                            }
                            if ($supplierVariant->stock < $item['quantity']) {
                                throw new \Exception("Insufficient stock for variant '{$supplierVariant->size}{$supplierVariant->color}{$supplierVariant->weight}'. Available: {$supplierVariant->stock}, Requested: {$item['quantity']}");
                            }
                            $supplierVariant->decrement('stock', $item['quantity']);
                        } else {
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

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.created'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.created'));

        return [
            'data' => $po->load(['supplier', 'items.product', 'items.supplierProduct']),
            'status_code' => 201,
        ];
    }
}
