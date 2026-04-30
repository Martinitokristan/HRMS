<?php

namespace App\Services\PurchaseOrders;

use App\Models\PurchaseOrder;

class PurchaseOrderQueryService
{
    /**
     * Get all purchase orders with filtering.
     */
    public function list($tab = null, $status = null, $search = null, $perPage = 20)
    {
        $query = PurchaseOrder::with([
            'supplier', 'creator', 'items.product', 'items.supplierProduct',
            'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue'
        ])
        ->when($tab, function ($q) use ($tab) {
            if ($tab === 'requests') {
                return $q->whereIn('status', ['pending', 'pending_supplier', 'accepted']);
            } elseif ($tab === 'completed') {
                return $q->whereIn('status', ['supplier_delivered', 'received', 'rejected', 'cancelled']);
            }
        })
        ->when($status, function ($q) use ($status) {
            return $q->where('status', $status);
        })
        ->when($search, function ($q) use ($search) {
            return $q->where('po_number', 'like', "%{$search}%");
        })
        ->latest();

        return [
            'data' => $query->paginate($perPage),
            'status_code' => 200,
        ];
    }

    /**
     * Get single purchase order.
     */
    public function show($id)
    {
        $po = PurchaseOrder::with([
            'supplier', 'creator', 'items.product', 'items.supplierProduct',
            'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue'
        ])->findOrFail($id);

        return [
            'data' => $po,
            'status_code' => 200,
        ];
    }

    /**
     * Get supplier's purchase orders.
     */
    public function supplierList($supplierId, $tab = null, $status = null, $perPage = 20)
    {
        $query = PurchaseOrder::with([
            'supplier', 'creator', 'items.product', 'items.supplierProduct',
            'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue'
        ])
        ->where('supplier_id', $supplierId)
        ->when($tab, function ($q) use ($tab) {
            if ($tab === 'requests') {
                return $q->whereIn('status', ['pending_supplier', 'accepted']);
            } elseif ($tab === 'completed') {
                return $q->whereIn('status', ['supplier_delivered', 'received', 'rejected', 'cancelled']);
            }
        })
        ->when($status, function ($q) use ($status) {
            return $q->where('status', $status);
        })
        ->latest();

        return [
            'data' => $query->paginate($perPage),
            'status_code' => 200,
        ];
    }

    /**
     * Get supplier's single purchase order.
     */
    public function supplierShow($supplierId, $id)
    {
        $po = PurchaseOrder::with([
            'supplier', 'creator', 'items.product', 'items.productVariant.sizeValue',
            'items.productVariant.colorValue', 'items.productVariant.weightValue'
        ])
        ->where('supplier_id', $supplierId)
        ->findOrFail($id);

        return [
            'data' => $po,
            'status_code' => 200,
        ];
    }
}
