<?php

namespace App\Services\PurchaseOrders;

use App\Models\PurchaseOrder;
use App\Models\User;
use App\Models\SupplierProduct;
use App\Models\SupplierProductVariant;
use App\Events\DataMutated;
use App\Notifications\PurchaseOrderAccepted;
use App\Notifications\PurchaseOrderDelivered;
use Illuminate\Support\Facades\Notification;
use DB;

class PurchaseOrderSupplierService
{
    /**
     * Supplier accept purchase order.
     */
    public function accept($supplierId, $poId)
    {
        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'pending_supplier')
            ->findOrFail($poId);

        $po->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        $admins = User::where('role', 'admin')->get();
        Notification::send($admins, new PurchaseOrderAccepted($po));

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.accepted'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.accepted'));

        return [
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'status_code' => 200,
        ];
    }

    /**
     * Supplier reject purchase order and restore stock.
     */
    public function reject($supplierId, $poId, $rejectionReason)
    {
        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'pending_supplier')
            ->findOrFail($poId);

        DB::transaction(function () use ($po, $rejectionReason) {
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

            $po->update([
                'status' => 'rejected',
                'rejection_reason' => $rejectionReason,
            ]);
        });

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'supplier_products'], 'purchase_order.rejected'));
        broadcast(new DataMutated("private-supplier.{$po->supplier_id}", ['supplier_orders', 'supplier_dashboard', 'supplier_products'], 'purchase_order.rejected'));

        return [
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'status_code' => 200,
        ];
    }

    /**
     * Supplier mark purchase order as delivered.
     */
    public function deliver($supplierId, $poId, $deliveryNotes = null)
    {
        $po = PurchaseOrder::where('supplier_id', $supplierId)
            ->where('status', 'accepted')
            ->findOrFail($poId);

        $po->update([
            'status' => 'supplier_delivered',
            'delivered_at' => now(),
            'delivered_by' => $supplierId,
            'delivery_notes' => $deliveryNotes,
        ]);

        $admins = User::where('role', 'admin')->get();
        Notification::send($admins, new PurchaseOrderDelivered($po));

        broadcast(new DataMutated('private-admin', ['admin_purchases', 'admin_dashboard', 'admin_notifications'], 'purchase_order.delivered'));
        broadcast(new DataMutated("private-supplier.{$supplierId}", ['supplier_orders', 'supplier_dashboard'], 'purchase_order.delivered'));

        return [
            'data' => $po->fresh()->load(['supplier', 'items.product']),
            'status_code' => 200,
        ];
    }
}
