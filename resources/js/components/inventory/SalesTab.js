import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import Modal from '../shared/Modal';
import { StatusBadge } from '../shared/Badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { STALE_KEYS, markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function SalesTab() {
    const { showToast } = useToast();
    const { settings } = useAuth();
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_ORDERS);
    
    const [sales, setSales] = useState({ data: [], total: 0, current_page: 1 });
    const [loading, setLoading] = useState(sales.data.length === 0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [viewOrder, setViewOrder] = useState(null);
    const [receiptOrder, setReceiptOrder] = useState(null);

    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        message: '',
        onConfirm: null,
        variant: 'default'
    });

    const showConfirm = (title, message, onConfirm, variant = 'default') => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };

    const closeConfirm = () => {
        setConfirmModal({
            show: false,
            title: '',
            message: '',
            onConfirm: null,
            variant: 'default'
        });
    };

    const fetchProds = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/sales', { params: { page, search, status: statusFilter } });
            const paginated = res.data.data;
            setSales({
                data: paginated.data || [],
                total: paginated.total || 0,
                current_page: paginated.current_page || 1
            });
        } catch (err) {
            // never wipe existing data on background error
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchProds(sales.data.length > 0);
        }, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, statusFilter, refreshTrigger]);

    const performReturn = async (saleId) => {
        try {
            await api.post(`/sales/${saleId}/return`);
            showToast('Order returned and stock restored');
            markStale(
                STALE_KEYS.ADMIN_ORDERS,
                STALE_KEYS.ADMIN_INVENTORY,
                STALE_KEYS.ADMIN_DASHBOARD,
                STALE_KEYS.CUSTOMER_ORDERS
            );
            fetchProds(true);
            setViewOrder(null);
            closeConfirm();
        } catch (err) {
            showToast('Failed to return order', 'error');
        }
    };

    const handleReturn = (saleId) => {
        showConfirm(
            'Return Order',
            'Are you sure you want to mark this sale as returned? Stock will be added back to inventory.',
            () => performReturn(saleId),
            'destructive'
        );
    };

    const performUpdateStatus = async (saleId, newStatus) => {
        try {
            const res = await api.put(`/sales/${saleId}/status`, { status: newStatus });
            showToast(res.data.message || 'Status updated');
            setViewOrder(res.data.data);
            markStale(
                STALE_KEYS.ADMIN_ORDERS,
                STALE_KEYS.ADMIN_DASHBOARD,
                STALE_KEYS.ADMIN_DELIVERIES,
                STALE_KEYS.CUSTOMER_ORDERS,
                STALE_KEYS.RIDER_DASHBOARD
            );
            fetchProds(true);
            closeConfirm();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update status', 'error');
        }
    };

    const handleUpdateStatus = (saleId, newStatus) => {
        const labels = { confirmed: 'confirm', out_for_delivery: 'mark as out for delivery', delivered: 'mark as delivered', cancelled: 'cancel' };
        showConfirm(
            'Update Status',
            `Are you sure you want to ${labels[newStatus] || newStatus} this order?`,
            () => performUpdateStatus(saleId, newStatus),
            newStatus === 'cancelled' ? 'destructive' : 'default'
        );
    };

    const getNextStatuses = (currentStatus) => {
        const flow = {
            pending: ['confirmed', 'cancelled'],
            pending_payment: ['confirmed', 'cancelled'],
            verifying_payment: ['confirmed', 'pending_payment', 'cancelled'],
            confirmed: ['cancelled'], // Restricted: Rider must handle the Out for Delivery step
            out_for_delivery: [],     // Restricted: Rider must handle the Delivered step
            delivered: [],
            returned: [],
            cancelled: [],
        };
        return flow[currentStatus] || [];
    };

    const statusButtonConfig = (status) => {
        const configs = {
            confirmed: { variant: 'default', className: 'bg-info hover:bg-info/90', label: 'Confirm Order' },
            pending_payment: { variant: 'outline', className: 'text-amber-600 border-amber-300 hover:bg-amber-50', label: 'Reject Proof' },
            out_for_delivery: { variant: 'default', className: 'bg-violet hover:bg-violet/90', label: 'Mark Out for Delivery' },
            delivered: { variant: 'default', className: 'bg-success hover:bg-success/90', label: 'Mark Delivered' },
            cancelled: { variant: 'destructive', className: '', label: 'Cancel Order' },
        };
        return configs[status] || { variant: 'secondary', className: '', label: status };
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <FilterBar 
                    search={search} onSearchChange={v => { setSearch(v); setPage(1); }}
                    filters={[
                        {
                            value: statusFilter, onChange: v => { setStatusFilter(v); setPage(1); },
                            options: [
                                { value: '', label: 'All Statuses' },
                                { value: 'pending', label: 'Pending (COD)' },
                                { value: 'pending_payment', label: 'Pending Payment (GCash)' },
                                { value: 'verifying_payment', label: 'Verifying GCash Proof' },
                                { value: 'confirmed', label: 'Confirmed' },
                                { value: 'out_for_delivery', label: 'Out for Delivery' },
                                { value: 'delivered', label: 'Delivered' },
                                { value: 'returned', label: 'Returned' },
                                { value: 'cancelled', label: 'Cancelled' },
                            ]
                        }
                    ]}
                />
                
                <Button className="shrink-0" onClick={() => alert('POS feature coming soon')}>
                    + New Sale
                </Button>
            </div>

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">Order No.</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">Customer</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-right">Total Amount</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">Payment</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-10"><div className="spinner mx-auto"/></TableCell></TableRow>
                        ) : sales.data.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No sales orders found</TableCell></TableRow>
                        ) : sales.data.map(sale => (
                            <TableRow key={sale.id}>
                                <TableCell className="px-4 py-3 font-semibold text-primary">{sale.order_number}</TableCell>
                                <TableCell className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                    {new Date(sale.created_at).toLocaleString('en-US', { disable12Hour: true, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="font-semibold text-foreground">{sale.customer?.name}</div>
                                    <div className="text-[12px] text-muted-foreground">{sale.customer?.email}</div>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-right font-bold text-foreground">₱{Number(sale.total_amount).toFixed(2)}</TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                    <Badge variant="secondary">{sale.payment_method}</Badge>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center"><StatusBadge status={sale.status} /></TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                    {sale.status === 'delivered' ? (
                                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-white" onClick={() => setReceiptOrder(sale)}>
                                            View Receipt
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => setViewOrder(sale)}>View</Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={sales.total} perPage={15} onChange={setPage} />

            <Modal isOpen={!!viewOrder} onClose={() => setViewOrder(null)} title={`Order ${viewOrder?.order_number}`} size="md">
                {viewOrder && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="bg-secondary/50 p-4">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Customer Details</div>
                                <div className="font-semibold text-foreground">{viewOrder.customer?.name}</div>
                                <div className="text-sm text-muted-foreground">{viewOrder.customer?.phone}</div>
                            </Card>
                            <Card className="bg-secondary/50 p-4">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Order Summary</div>
                                <div className="flex justify-between mb-1 text-sm"><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewOrder.status} /></div>
                                <div className="flex justify-between mb-1 text-sm"><span className="text-muted-foreground">Payment:</span> <span className="font-semibold text-foreground">{viewOrder.payment_method.toUpperCase()}</span></div>
                                <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-border"><span>Total:</span> <span className="text-primary">₱{Number(viewOrder.total_amount).toFixed(2)}</span></div>
                            </Card>

                            {viewOrder.payment_method === 'gcash' && viewOrder.payment_phone_number && (
                                <Card className="bg-blue-50 border-blue-200 p-4 sm:col-span-2">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-2">GCash Payment Details</div>

                                    {/* Expiry SMS warning */}
                                    {viewOrder.payment_expiry_sms_sent_at && viewOrder.status === 'pending_payment' && (
                                        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-700">
                                                <strong>Expiry SMS sent</strong> — The 15-minute window passed with no automatic match.
                                                Customer was sent a proof submission link. Waiting for their upload.
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-xs text-muted-foreground">Paying Phone Number</div>
                                            <div className="font-bold text-blue-900">{viewOrder.payment_phone_number}</div>
                                        </div>
                                        {viewOrder.payment_reference && (
                                            <div>
                                                <div className="text-xs text-muted-foreground">Reference Number</div>
                                                <div className="font-bold text-blue-900 font-mono">{viewOrder.payment_reference}</div>
                                            </div>
                                        )}
                                    </div>

                                    {viewOrder.payment_proof_path && (
                                        <div className="mt-3 pt-3 border-t border-blue-200/50 space-y-3">
                                            <div className="text-xs text-muted-foreground">Payment Screenshot Proof</div>
                                            <a href={`/storage/${viewOrder.payment_proof_path}`} target="_blank" rel="noreferrer" className="block w-32 h-32 rounded-lg overflow-hidden border border-blue-200 hover:opacity-90 transition-opacity">
                                                <img src={`/storage/${viewOrder.payment_proof_path}`} alt="GCash Receipt" className="w-full h-full object-cover" />
                                            </a>
                                            {/* Admin verification reminder */}
                                            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                                <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                                <p className="text-xs text-red-700">
                                                    <strong>Verify before confirming:</strong> Cross-check the reference number and amount against your GCash Transaction History. Reject if proof appears edited or AI-generated.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            )}
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-foreground mb-3">Order Items</h4>
                            <Card className="overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">Item</TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-center">Qty</TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-right">Unit Price</TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-right">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewOrder.items?.map(i => {
                                            const vLabel = i.product_variant
                                                ? [i.product_variant.size_value?.label, i.product_variant.color_value?.label, i.product_variant.weight_value?.label].filter(Boolean).join(' / ')
                                                : null;
                                            return (
                                            <TableRow key={i.id}>
                                                <TableCell className="px-4 py-3">
                                                    <div className="font-semibold text-foreground">{i.product?.name}</div>
                                                    {vLabel
                                                        ? <div className="text-[11px] text-primary font-medium mt-0.5">{vLabel}</div>
                                                        : <div className="text-[11px] text-muted-foreground mt-0.5">Base product · {i.product?.barcode}</div>
                                                    }
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center font-bold">{parseInt(i.quantity)}</TableCell>
                                                <TableCell className="px-4 py-3 text-right text-muted-foreground">₱{Number(i.unit_price).toFixed(2)}</TableCell>
                                                <TableCell className="px-4 py-3 text-right font-semibold text-foreground">₱{Number(i.subtotal).toFixed(2)}</TableCell>
                                            </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </Card>
                        </div>

                        {getNextStatuses(viewOrder.status).length > 0 && (
                            <div className="flex gap-3">
                                {getNextStatuses(viewOrder.status).map(nextStatus => {
                                    const config = statusButtonConfig(nextStatus);
                                    return (
                                        <Button
                                            key={nextStatus}
                                            variant={config.variant}
                                            className={`flex-1 ${config.className}`}
                                            onClick={() => handleUpdateStatus(viewOrder.id, nextStatus)}
                                        >
                                            {config.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}

                        {viewOrder.status !== 'returned' && viewOrder.status !== 'cancelled' && viewOrder.status === 'delivered' && (
                            <Button variant="destructive" className="w-full" onClick={() => handleReturn(viewOrder.id)}>
                                Mark as Returned & Restock
                            </Button>
                        )}
                    </div>
                )}
            </Modal>
            
            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />

            {receiptOrder && (
                <SalesReceiptModal
                    order={receiptOrder}
                    settings={settings}
                    onClose={() => setReceiptOrder(null)}
                />
            )}
        </div>
    );
}

function SalesReceiptModal({ order, onClose, settings }) {
    const storeName = settings?.general?.store_name || 'Store';
    const storeAddress = settings?.general?.store_address || '';
    const storePhone = settings?.general?.contact_number || '';
    const storeEmail = settings?.general?.contact_email || '';
    const taxRate = parseFloat(settings?.general?.tax_rate || 0);

    const itemsSubtotal = order.items?.reduce((sum, i) => sum + Number(i.subtotal || 0), 0) || 0;
    const discountPct = Number(order.discount_pct || 0);
    const discountAmount = itemsSubtotal * discountPct / 100;
    const afterDiscount = itemsSubtotal - discountAmount;
    const vatAmount = taxRate > 0 ? afterDiscount * taxRate / 100 : 0;
    const grandTotal = Number(order.total_amount || 0);

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    const fmtMoney = (n) => `\u20b1${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl relative">

                    {/* Close button — top-right */}
                    <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground h-7 w-7 z-10">
                        <X className="h-3.5 w-3.5" />
                    </Button>

                    {/* Receipt body */}
                    <div id="sales-receipt-area" className="px-8 pt-8 pb-8 space-y-5">

                        {/* Store header — name only */}
                        <div className="flex flex-col items-center text-center gap-1 pb-5 border-b border-gray-200">
                            <h1 className="text-xl font-bold text-gray-900">{storeName}</h1>
                            {storeAddress && <p className="text-xs text-gray-500">{storeAddress}</p>}
                            {(storePhone || storeEmail) && (
                                <p className="text-xs text-gray-500">{[storePhone, storeEmail].filter(Boolean).join(' · ')}</p>
                            )}
                            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 border border-gray-200 rounded-full px-3 py-0.5">Official Receipt</span>
                        </div>

                        {/* OR meta row */}
                        <div className="grid grid-cols-3 gap-4 py-1">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">OR Number</p>
                                <p className="font-black text-base text-primary">{order.order_number}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Date Ordered</p>
                                <p className="text-sm font-semibold text-gray-800">{fmtDate(order.created_at)}</p>
                            </div>
                            {order.delivery?.delivered_at && (
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Date Delivered</p>
                                    <p className="text-sm font-semibold text-primary">{fmtDate(order.delivery.delivered_at)}</p>
                                </div>
                            )}
                        </div>

                        {/* Bill to / address / payment */}
                        <div className="grid grid-cols-3 gap-4 border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
                                <p className="font-bold text-sm text-gray-900 leading-snug">{order.customer?.name}</p>
                                {order.customer?.email && <p className="text-xs text-primary mt-0.5">{order.customer.email}</p>}
                                {order.customer?.phone && <p className="text-xs text-gray-500 mt-0.5">{order.customer.phone}</p>}
                            </div>
                            {order.delivery?.address && (
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Delivery Address</p>
                                    <p className="text-xs text-gray-700 leading-snug">{order.delivery.address}</p>
                                </div>
                            )}
                            <div className="text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Payment</p>
                                <Badge variant="outline" className="uppercase font-semibold text-xs">
                                    {order.payment_method}
                                </Badge>
                                {order.payment_reference && (
                                    <p className="text-[11px] text-gray-400 font-mono mt-1">Ref: {order.payment_reference}</p>
                                )}
                                {order.payment_phone_number && (
                                    <p className="text-[11px] text-gray-400 mt-0.5">{order.payment_phone_number}</p>
                                )}
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
                            {order.items?.map((item, idx) => {
                                const variantLabel = item.product_variant
                                    ? [item.product_variant.size_value?.label, item.product_variant.color_value?.label, item.product_variant.weight_value?.label].filter(Boolean).join(' / ')
                                    : null;
                                return (
                                    <div key={item.id || idx} className="grid grid-cols-[1fr_60px_80px_80px] gap-2 py-3 border-b border-gray-100 items-start">
                                        <div>
                                            <p className="font-semibold text-sm text-gray-900">{item.product?.name}</p>
                                            {variantLabel
                                                ? <p className="text-[11px] text-primary font-medium mt-0.5">{variantLabel}</p>
                                                : <p className="text-[11px] text-gray-400 mt-0.5">Base · {item.product?.barcode}</p>
                                            }
                                        </div>
                                        <p className="text-sm font-semibold text-gray-800 text-center pt-0.5">{parseInt(item.quantity)}</p>
                                        <p className="text-sm text-gray-500 text-right pt-0.5">{fmtMoney(item.unit_price)}</p>
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
                                    <span className="font-semibold text-gray-800">{fmtMoney(itemsSubtotal)}</span>
                                </div>
                                {discountPct > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Discount ({discountPct}%)</span>
                                        <span className="font-semibold text-red-500">− {fmtMoney(discountAmount)}</span>
                                    </div>
                                )}
                                {taxRate > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Tax ({taxRate}%)</span>
                                        <span className="font-semibold text-gray-800">{fmtMoney(vatAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-start pt-3 mt-1 border-t-2 border-black gap-2">
                                    <span className="font-black text-sm text-gray-900 uppercase leading-tight">Grand<br/>Total</span>
                                    <span className="font-black text-2xl text-primary">{fmtMoney(grandTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <p className="text-center text-[11px] text-gray-400 pt-4 border-t border-gray-100 italic">
                            Thank you for your purchase! Please keep this receipt for your records.
                            {storeEmail ? ` For inquiries, contact ${storeEmail}.` : ''}
                        </p>

                    </div>
                </div>
            </div>
    );
}
