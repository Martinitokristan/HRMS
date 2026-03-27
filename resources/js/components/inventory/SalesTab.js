import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import Modal from '../shared/Modal';
import { StatusBadge } from '../shared/Badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function SalesTab() {
    const { showToast } = useToast();
    const { refreshTrigger } = useSilentRefresh('admin_sales');
    
    const [sales, setSales] = useState({ data: [], total: 0, current_page: 1 });
    const [loading, setLoading] = useState(sales.data.length === 0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [viewOrder, setViewOrder] = useState(null);

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
            const res = await axios.get('/sales', { params: { page, search, status: statusFilter } });
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
            await axios.post(`/sales/${saleId}/return`);
            showToast('Order returned and stock restored');
            markStale('admin_sales', 'admin_stock', 'admin_dashboard', 'customer_orders');
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
            const res = await axios.put(`/sales/${saleId}/status`, { status: newStatus });
            showToast(res.data.message || 'Status updated');
            setViewOrder(res.data.data);
            markStale('admin_sales', 'admin_dashboard', 'admin_deliveries', 'customer_orders', 'rider_dashboard');
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
                                { value: 'pending', label: 'Pending' },
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
                                <TableCell className="px-4 py-3 text-muted-foreground">{new Date(sale.created_at).toLocaleDateString()}</TableCell>
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
                                    <Button variant="outline" size="sm" onClick={() => setViewOrder(sale)}>View</Button>
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
                                        {viewOrder.items?.map(i => (
                                            <TableRow key={i.id}>
                                                <TableCell className="px-4 py-3 text-foreground">{i.product?.name} <span className="text-[12px] text-muted-foreground">({i.product?.barcode})</span></TableCell>
                                                <TableCell className="px-4 py-3 text-center font-bold">{i.quantity}</TableCell>
                                                <TableCell className="px-4 py-3 text-right text-muted-foreground">₱{Number(i.unit_price).toFixed(2)}</TableCell>
                                                <TableCell className="px-4 py-3 text-right font-semibold text-foreground">₱{Number(i.subtotal).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
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
        </div>
    );
}
