<?php

namespace App\Services\PurchaseOrders;

use App\Models\PurchaseOrder;
use App\Models\SupplierProduct;
use App\Models\SupplierProductVariant;
use App\Events\DataMutated;
use App\Notifications\PurchaseOrderRequest;
use Illuminate\Support\Facades\Notification;
use DB;

class PurchaseOrderApprovalService
{
    /**
     * Approve purchase order.
     */
    public function approve($id)
    {
        $po = PurchaseOrder::findOrFail($id);

        if ($po->status !== 'pending') {
            return [
                'error' => 'Only pending POs can be approved.',
                'status_code' => 422,
            ];
        }

        $po->update(['status' => 'pending_supplier']);

        $po->load(['supplier', 'items.product', 'items.supplierProduct']);
        if ($po->supplier) {
            $po->supplier->notify(new PurchaseOrderRequest($po));
        }

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.approved'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_notifications', 'supplier_products'], 'purchase_order.approved'));

        return [
            'data' => $po,
            'status_code' => 200,
        ];
    }

    /**
     * Decline purchase order and restore supplier stock.
     */
    public function decline($id)
    {
        $po = PurchaseOrder::with('items')->findOrFail($id);

        if ($po->status !== 'pending') {
            return [
                'error' => 'Only pending POs can be declined.',
                'status_code' => 422,
            ];
        }

        DB::transaction(function () use ($po) {
            foreach ($po->items as $item) {
                if ($item->supplier_product_id) {
                    $supplierProduct = SupplierProduct::find($item->supplier_product_id);
                    if ($supplierProduct) {
                        if ($item->supplier_product_variant_id) {
                            $supplierVariant = SupplierProductVariant::find($item->supplier_product_variant_id);
                            if ($supplierVariant) {
                                $supplierVariant->increment('stock', $item->quantity);
                                $supplierProduct->increment('total_stock', $item->quantity);
                            }
                        } else {
                            $supplierProduct->increment('total_stock', $item->quantity);
                        }
                    }
                }
            }

            $po->update(['status' => 'cancelled']);
        });

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.declined'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.declined'));

        return [
            'data' => $po,
            'status_code' => 200,
        ];
    }
}
