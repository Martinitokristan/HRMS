import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPPLIER_STATUS = {
    active:      { bg: 'bg-[#dcfce7]', text: 'text-[#16a34a]', label: 'Active' },
    pending:     { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Approval' },
    inactive:    { bg: 'bg-gray-100',  text: 'text-gray-500',  label: 'Inactive' },
};

const PO_STATUS = {
    received:  { bg: 'bg-[#dcfce7]',  text: 'text-[#16a34a]', label: 'Received' },
    delivered: { bg: 'bg-[#dcfce7]',  text: 'text-[#16a34a]', label: 'Delivered' },
    pending:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
    approved:  { bg: 'bg-blue-50',    text: 'text-blue-600',   label: 'Approved' },
    ordered:   { bg: 'bg-blue-50',    text: 'text-blue-600',   label: 'Ordered' },
    cancelled: { bg: 'bg-red-50',     text: 'text-red-600',    label: 'Cancelled' },
    declined:  { bg: 'bg-red-50',     text: 'text-red-600',    label: 'Declined' },
    rejected:  { bg: 'bg-red-50',     text: 'text-red-600',    label: 'Rejected' },
};

const SupplierBadge = ({ status }) => {
    const s = SUPPLIER_STATUS[status] || SUPPLIER_STATUS.inactive;
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
};

const POBadge = ({ status }) => {
    const s = PO_STATUS[status] || { bg: 'bg-gray-100', text: 'text-gray-500', label: status };
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
};

export default function SupplierViewModal({ isOpen, onClose, supplierId, onEdit }) {
    const { showToast } = useToast();
    const [supplier, setSupplier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const isPendingSupplier = supplier?.status === 'pending';
    const canManageSupplier = supplier && !isPendingSupplier;

    const handleStatusAction = async (nextStatus, successMessage) => {
        if (!supplier?.id || actionLoading) return;

        setActionLoading(true);
        try {
            const payload = {
                name: supplier.name,
                contact_name: supplier.contact_name || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
                status: nextStatus,
            };

            const res = await api.put(`/suppliers/${supplier.id}`, payload);
            const updatedSupplier = res.data?.data !== undefined ? res.data.data : res.data;

            setSupplier(prev => ({
                ...(prev || {}),
                ...updatedSupplier,
                status: nextStatus,
            }));

            showToast(successMessage);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to update supplier status', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !supplierId) return;
        let isMounted = true;
        setLoading(true);
        api.get(`/suppliers/${supplierId}`)
            .then(res => {
                if (isMounted) {
                    setSupplier(res.data.data !== undefined ? res.data.data : res.data);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) {
                    showToast('Failed to load supplier details', 'error');
                    setLoading(false);
                }
            });
        return () => { isMounted = false; };
    }, [isOpen, supplierId]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-[560px] bg-white rounded-[8px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col max-h-[92vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <span className="text-[15px] font-semibold text-[#111]">Supplier Details</span>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors rounded p-0.5"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="border-t border-[#e5e7eb]" />

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="spinner" />
                        </div>
                    ) : !supplier ? (
                        <p className="text-center py-8 text-sm text-gray-400">Failed to load supplier.</p>
                    ) : (
                        <div className="space-y-4">

                            {/* Identity Block */}
                            <div className="pb-3 border-b border-[#e5e7eb]">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[17px] font-bold text-[#f97316]">{supplier.name}</span>
                                    <SupplierBadge status={supplier.status || 'active'} />
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-[6px]">
                                    <div>
                                        <p className="text-xs text-[#6b7280]">Contact Person</p>
                                        <p className="text-sm text-[#111827]">{supplier.contact_name || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[#6b7280]">Email</p>
                                        <p className="text-sm text-[#111827] break-all">{supplier.email || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[#6b7280]">Phone</p>
                                        <p className="text-sm text-[#111827]">{supplier.phone || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[#6b7280]">Address</p>
                                        <p className="text-sm text-[#111827]">{supplier.address || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {canManageSupplier ? (
                                <>
                                    {/* Stats Row */}
                                    <div className="flex gap-3">
                                        <div className="flex-1 flex flex-col bg-[#f9fafb] border border-[#e5e7eb] rounded-[8px] px-4 py-[10px]">
                                            <span className="text-xs text-[#6b7280]">Products</span>
                                            <span className="text-[20px] font-bold text-[#111827] leading-snug">
                                                {supplier.products?.length ?? supplier.products_count ?? 0}
                                            </span>
                                        </div>
                                        <div className="flex-1 flex flex-col bg-[#f9fafb] border border-[#e5e7eb] rounded-[8px] px-4 py-[10px]">
                                            <span className="text-xs text-[#6b7280]">Orders</span>
                                            <span className="text-[20px] font-bold text-[#111827] leading-snug">
                                                {supplier.purchase_orders?.length ?? supplier.purchase_orders_count ?? 0}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Purchase Orders Table */}
                                    <div>
                                        <p className="text-xs text-[#6b7280] uppercase tracking-[0.05em] mb-1.5">Purchase Orders</p>
                                        <div className="max-h-[140px] overflow-y-auto rounded-[6px] border border-[#e5e7eb]">
                                            <table className="w-full text-[13px]">
                                                <thead className="sticky top-0">
                                                    <tr className="bg-[#f9fafb]">
                                                        <th className="text-left px-[10px] py-2 text-[12px] font-medium text-[#6b7280]">PO Number</th>
                                                        <th className="text-left px-[10px] py-2 text-[12px] font-medium text-[#6b7280]">Products</th>
                                                        <th className="text-left px-[10px] py-2 text-[12px] font-medium text-[#6b7280]">Date</th>
                                                        <th className="text-left px-[10px] py-2 text-[12px] font-medium text-[#6b7280]">Amount</th>
                                                        <th className="text-left px-[10px] py-2 text-[12px] font-medium text-[#6b7280]">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {!supplier.purchase_orders || supplier.purchase_orders.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="text-center py-4 text-[13px] text-[#6b7280]">
                                                                No purchase orders found.
                                                            </td>
                                                        </tr>
                                                    ) : supplier.purchase_orders.map((po, idx) => {
                                                        const productNames = po.items?.map(it => it.product?.name).filter(Boolean) || [];
                                                        const displayProducts = productNames.length > 2
                                                            ? `${productNames.slice(0, 2).join(', ')} +${productNames.length - 2}`
                                                            : productNames.join(', ') || '—';
                                                        return (
                                                            <tr key={po.id} className={idx % 2 === 1 ? 'bg-[#fafafa]' : 'bg-white'}>
                                                                <td className="px-[10px] py-2 font-semibold text-[#111827] whitespace-nowrap">{po.po_number}</td>
                                                                <td className="px-[10px] py-2 text-[#374151] max-w-[90px] truncate">{displayProducts}</td>
                                                                <td className="px-[10px] py-2 text-[#6b7280] whitespace-nowrap">
                                                                    {new Date(po.created_at).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-[10px] py-2 font-semibold text-[#111827] whitespace-nowrap">
                                                                    ₱{Number(po.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-[10px] py-2">
                                                                    <POBadge status={po.status} />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
                                    <p className="text-[13px] font-medium text-[#111827] mb-1">Approval Information</p>
                                    <p className="text-[13px] text-[#6b7280]">
                                        This supplier account is currently {supplier.status || 'inactive'}. Purchase order and product performance details will appear once the account is approved and active.
                                    </p>
                                </div>
                            )}

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-[#e5e7eb] px-6 pt-3 pb-5 flex items-center justify-end gap-2">
                    {supplier && isPendingSupplier && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-[34px]"
                                disabled={actionLoading}
                                onClick={() => handleStatusAction('inactive', 'Supplier rejected successfully')}
                            >
                                Reject
                            </Button>
                            <Button
                                type="button"
                                className="h-[34px] bg-[#f97316] hover:bg-orange-600 text-white"
                                disabled={actionLoading}
                                onClick={() => handleStatusAction('active', 'Supplier approved successfully')}
                            >
                                Approve
                            </Button>
                        </>
                    )}

                    {canManageSupplier && (
                        <Button
                            type="button"
                            className="h-[34px] bg-[#f97316] hover:bg-orange-600 text-white font-medium flex items-center gap-1.5"
                            onClick={() => onEdit(supplier)}
                        >
                            <Pencil className="h-3 w-3" /> Edit Supplier
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
