import React from 'react';
import { X } from 'lucide-react';

const PO_STATUS = {
    received:  { bg: 'bg-[#dcfce7]', text: 'text-[#16a34a]' },
    delivered: { bg: 'bg-[#dcfce7]', text: 'text-[#16a34a]' },
    pending:   { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    approved:  { bg: 'bg-blue-50',   text: 'text-blue-600' },
    ordered:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
    cancelled: { bg: 'bg-red-50',    text: 'text-red-600' },
    declined:  { bg: 'bg-red-50',    text: 'text-red-600' },
    rejected:  { bg: 'bg-red-50',    text: 'text-red-600' },
};

const POStatusBadge = ({ status }) => {
    const s = PO_STATUS[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
    const label = (status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
        <span className={`inline-flex items-center rounded-[20px] px-[10px] py-[2px] text-[11px] font-medium ${s.bg} ${s.text}`}>
            {label}
        </span>
    );
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
const fmtMoney = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PoReceiptModal({ po, onClose, settings }) {
    const storeName = settings?.general?.store_name || 'Store';
    const storeEmail = settings?.general?.contact_email || '';
    const totalCost = Number(po.total_cost || 0);

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-[600px] rounded-[10px] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)] bg-white max-h-[92vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Close button overlays light header */}
                <button
                    onClick={onClose}
                    className="absolute top-[14px] right-[16px] text-[#6b7280] hover:text-[#111827] transition-colors z-10"
                >
                    <X className="h-[18px] w-[18px]" />
                </button>

                {/* Light Gray Header Banner */}
                <div className="bg-[#f3f4f6] px-6 py-[18px] flex flex-col items-center text-center shrink-0 border-b border-[#e5e7eb]">
                    <h1 className="text-[18px] font-bold text-[#111827] tracking-[0.02em]">{storeName}</h1>
                    <span className="mt-1.5 bg-[#e5e7eb] text-[#6b7280] text-[10px] tracking-[0.08em] px-3 py-[3px] rounded-[20px]">
                        OFFICIAL PURCHASE ORDER RECEIPT
                    </span>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1">

                    {/* Meta Info Row */}
                    <div className="flex gap-4 px-6 py-[14px] bg-[#f9fafb] border-b border-[#e5e7eb]">
                        <div className="flex-1">
                            <p className="text-[10px] text-[#9ca3af] uppercase tracking-[0.06em] mb-0.5">PO Number</p>
                            <p className="text-[15px] font-bold text-[#f97316]">{po.po_number}</p>
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-[#9ca3af] uppercase tracking-[0.06em] mb-0.5">Issue Date</p>
                            <p className="text-[14px] font-semibold text-[#111827]">{fmtDate(po.created_at)}</p>
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-[#9ca3af] uppercase tracking-[0.06em] mb-0.5">Delivery Due</p>
                            <p className="text-[14px] font-semibold text-[#f97316]">{fmtDate(po.updated_at)}</p>
                        </div>
                    </div>

                    {/* Supplier / Authorized By / Status */}
                    <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-[#e5e7eb]">
                        <div>
                            <p className="text-[10px] text-[#9ca3af] uppercase tracking-[0.06em] mb-0.5">Supplier</p>
                            <p className="text-[13px] font-semibold text-[#111827] leading-snug">{po.supplier?.name || '—'}</p>
                            {po.supplier?.email && <p className="text-[11px] text-[#f97316] mt-0.5">{po.supplier.email}</p>}
                        </div>
                        <div>
                            <p className="text-[10px] text-[#9ca3af] uppercase tracking-[0.06em] mb-0.5">Authorized By</p>
                            <p className="text-[13px] font-semibold text-[#111827] leading-snug">{po.creator?.name || '—'}</p>
                            {po.creator?.name && <p className="text-[11px] text-[#9ca3af] mt-0.5">Procurement</p>}
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-[#9ca3af] uppercase tracking-[0.06em] mb-0.5">Status</p>
                            <POStatusBadge status={po.status} />
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="px-6 mt-3">
                        <table className="w-full text-[13px] border-collapse">
                            <thead>
                                <tr className="bg-[#f3f4f6]">
                                    <th className="text-left px-[10px] py-[7px] text-[10px] font-medium text-[#6b7280] uppercase tracking-[0.05em]">Item Description</th>
                                    <th className="text-center px-[10px] py-[7px] text-[10px] font-medium text-[#6b7280] uppercase tracking-[0.05em]">QTY</th>
                                    <th className="text-center px-[10px] py-[7px] text-[10px] font-medium text-[#6b7280] uppercase tracking-[0.05em]">Unit Price</th>
                                    <th className="text-center px-[10px] py-[7px] text-[10px] font-medium text-[#6b7280] uppercase tracking-[0.05em]">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(po.items || []).map((item, idx) => {
                                    const productName = item.product?.name || item.supplier_product?.name || '—';
                                    const barcode = item.product?.barcode || item.supplier_product?.barcode || null;
                                    const variantLabel = item.product_variant
                                        ? [item.product_variant.size_value?.label, item.product_variant.color_value?.label, item.product_variant.weight_value?.label].filter(Boolean).join(' / ')
                                        : null;
                                    return (
                                        <tr key={item.id || idx} className="border-b border-[#f3f4f6]">
                                            <td className="px-[10px] py-[10px]">
                                                <p className="font-medium text-[#111827]">{productName}</p>
                                                {barcode && <p className="text-[11px] text-[#9ca3af] font-mono mt-0.5">Barcode: {barcode}</p>}
                                                {variantLabel && <p className="text-[11px] text-[#f97316] mt-0.5">{variantLabel}</p>}
                                            </td>
                                            <td className="px-[10px] py-[10px] text-center font-semibold text-[#111827]">{parseInt(item.quantity)}</td>
                                            <td className="px-[10px] py-[10px] text-center text-[#6b7280]">{fmtMoney(item.unit_cost)}</td>
                                            <td className="px-[10px] py-[10px] text-center font-bold text-[#111827]">{fmtMoney(item.subtotal)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end px-6 pb-4 pt-2.5">
                        <div className="w-52 space-y-1.5">
                            <div className="flex justify-between text-[13px]">
                                <span className="text-[#6b7280]">Subtotal</span>
                                <span className="font-medium text-[#111827]">{fmtMoney(totalCost)}</span>
                            </div>
                            <div className="border-t border-[#e5e7eb] pt-2 flex justify-between items-baseline gap-2">
                                <span className="text-[12px] font-bold text-[#111827] uppercase">Total Purchase Cost</span>
                                <span className="text-[18px] font-extrabold text-[#f97316]">{fmtMoney(totalCost)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-[10px] bg-[#f9fafb] border-t border-[#e5e7eb]">
                        <p className="text-[11px] text-[#9ca3af] italic text-center">
                            This document serves as an official purchase order receipt.
                            {storeEmail ? ` For inquiries, contact ${storeEmail}.` : ''}
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
