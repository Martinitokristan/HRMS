import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

export default function PoReceiptModal({ po, onClose, settings }) {
    const storeName = settings?.general?.store_name || 'Store';
    const storeAddress = settings?.general?.store_address || '';
    const storePhone = settings?.general?.contact_number || '';
    const storeEmail = settings?.general?.contact_email || '';

    const totalCost = Number(po.total_cost || 0);

    const fmtDate = (d) => d
        ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '—';
    const fmtMoney = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl relative">

                    {/* Close button — top-right */}
                    <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground h-7 w-7 z-10">
                        <X className="h-3.5 w-3.5" />
                    </Button>

                    {/* Receipt body */}
                    <div id="po-receipt-area" className="px-8 pt-8 pb-8 space-y-5">

                        {/* Store header — name only */}
                        <div className="flex flex-col items-center text-center gap-1 pb-5 border-b border-gray-200">
                            <h1 className="text-xl font-bold text-gray-900">{storeName}</h1>
                            {storeAddress && <p className="text-xs text-gray-500">{storeAddress}</p>}
                            {(storePhone || storeEmail) && (
                                <p className="text-xs text-gray-500">{[storePhone, storeEmail].filter(Boolean).join(' · ')}</p>
                            )}
                            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 border border-gray-200 rounded-full px-3 py-0.5">Official Purchase Order Receipt</span>
                        </div>

                        {/* PO meta row */}
                        <div className="grid grid-cols-3 gap-4 py-1">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">PO Number</p>
                                <p className="font-black text-base text-primary">{po.po_number}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Issue Date</p>
                                <p className="text-sm font-semibold text-gray-800">{fmtDate(po.created_at)}</p>
                            </div>
                            {po.updated_at && (
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Delivery Due</p>
                                    <p className="text-sm font-semibold text-primary">{fmtDate(po.updated_at)}</p>
                                </div>
                            )}
                        </div>

                        {/* Supplier / Authorized / Status — plain bordered section */}
                        <div className="grid grid-cols-3 gap-4 border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Supplier</p>
                                <p className="font-bold text-sm text-gray-900 leading-snug">{po.supplier?.name}</p>
                                {po.supplier?.email && <p className="text-xs text-primary mt-0.5">{po.supplier.email}</p>}
                            </div>
                            {po.creator?.name && (
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Authorized By</p>
                                    <p className="font-bold text-sm text-gray-900 leading-snug">{po.creator.name}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Procurement</p>
                                </div>
                            )}
                            <div className="text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Status</p>
                                <Badge variant="outline" className="capitalize font-semibold text-xs">
                                    {po.status?.replace(/_/g, ' ')}
                                </Badge>
                            </div>
                        </div>

                        {/* Items — plain rows with black header line */}
                        <div>
                            {/* Column headers */}
                            <div className="grid grid-cols-[1fr_60px_80px_80px] gap-2 pb-2 border-b border-black">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Item Description</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-center">QTY</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Unit Price</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Amount</p>
                            </div>
                            {/* Item rows */}
                            {po.items?.map((item, idx) => {
                                const productName = item.product?.name || item.supplier_product?.name || '—';
                                const barcode = item.product?.barcode || item.supplier_product?.barcode || null;
                                const variantLabel = item.product_variant
                                    ? [item.product_variant.size_value?.label, item.product_variant.color_value?.label, item.product_variant.weight_value?.label].filter(Boolean).join(' / ')
                                    : null;
                                return (
                                    <div key={item.id || idx} className="grid grid-cols-[1fr_60px_80px_80px] gap-2 py-3 border-b border-gray-100 items-start">
                                        <div>
                                            <p className="font-semibold text-sm text-gray-900">{productName}</p>
                                            {barcode && <p className="text-[11px] text-gray-400 font-mono mt-0.5">Barcode: {barcode}</p>}
                                            {variantLabel && <p className="text-[11px] text-primary font-medium mt-0.5">{variantLabel}</p>}
                                        </div>
                                        <p className="text-sm font-semibold text-gray-800 text-center pt-0.5">{parseInt(item.quantity)}</p>
                                        <p className="text-sm text-gray-500 text-right pt-0.5">{fmtMoney(item.unit_cost)}</p>
                                        <p className="text-sm font-bold text-gray-900 text-right pt-0.5">{fmtMoney(item.subtotal)}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Totals */}
                        <div className="flex justify-end">
                            <div className="w-52 space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Subtotal</span>
                                    <span className="font-semibold text-gray-800">{fmtMoney(totalCost)}</span>
                                </div>
                                <div className="flex justify-between items-start pt-3 mt-1 border-t-2 border-black gap-2">
                                    <span className="font-black text-sm text-gray-900 uppercase leading-tight">Total<br/>Purchase<br/>Cost</span>
                                    <span className="font-black text-2xl text-primary">{fmtMoney(totalCost)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <p className="text-center text-[11px] text-gray-400 pt-4 border-t border-gray-100 italic">
                            This document serves as an official purchase order receipt.
                            {storeEmail ? ` For inquiries, contact ${storeEmail}.` : ''}
                        </p>

                    </div>
                </div>
            </div>
    );
}
