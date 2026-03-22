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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { AlertCircle, CheckCircle2, XCircle, Loader2, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function PurchaseTab() {
    const { showToast } = useToast();
    const { refreshTrigger } = useSilentRefresh('admin_purchases');
    
    const [pos, setPos] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(pos.data.length === 0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [viewPo, setViewPo] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        show: false, title: '', message: '',
        onConfirm: null, variant: 'default'
    });
    const showConfirm = (title, message, onConfirm, variant = 'default') => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };
    const closeConfirm = () => {
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, variant: 'default' });
    };

    const fetchPos = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get('/purchase-orders', { params: { page, search, status: statusFilter } });
            const paginatedData = res.data.data;
            setPos({
                data: paginatedData.data ? paginatedData.data : paginatedData,
                total: paginatedData.total || paginatedData.length || 0
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
            fetchPos(pos.data.length > 0);
        }, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, statusFilter, refreshTrigger]);


    const handleAction = async (poId, action) => {
        setActionLoading(true);
        try {
            await axios.post(`/purchase-orders/${poId}/${action}`);
            showToast(`PO ${action}d successfully`);
            
            // Re-fetch quietly
            markStale('admin_purchases', 'admin_stock', 'admin_dashboard', 'supplier_orders');
            fetchPos(true);
            
            setViewPo(null);
            closeConfirm();
        } catch (err) {
            showToast(err.response?.data?.message || `Failed to ${action} PO`, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const confirmAction = (poId, action) => {
        const confirmMsg = action === 'approve' 
            ? 'Approve and send this PO to the supplier?' 
            : action === 'decline'
            ? 'Are you sure you want to decline/cancel this PO?'
            : 'Mark as received? This will automatically increase your inventory stock for all items in this PO.';
        
        showConfirm('Confirm Action', confirmMsg, () => handleAction(poId, action), action === 'decline' ? 'destructive' : 'default');
    };


    return (
        <div>
            <div className="mb-4">
                <FilterBar 
                    search={search} onSearchChange={v => { setSearch(v); setPage(1); }}
                    filters={[
                        {
                            value: statusFilter, onChange: v => { setStatusFilter(v); setPage(1); },
                            options: [
                                { value: '',                   label: 'All Statuses' },
                                { value: 'pending',            label: 'Pending' },
                                { value: 'pending_supplier',   label: 'Approved / Sent' },
                                { value: 'accepted',           label: 'Accepted' },
                                { value: 'rejected',           label: 'Rejected' },
                                { value: 'supplier_delivered', label: 'Delivered' },
                                { value: 'received',           label: 'Received' },
                                { value: 'cancelled',          label: 'Declined' },
                            ]
                        }
                    ]}
                />
            </div>

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">PO Number</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider">Supplier</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-right">Total Cost</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">Items</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                            <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-10"><div className="spinner mx-auto"/></TableCell></TableRow>
                        ) : pos.data.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No purchase orders found</TableCell></TableRow>
                        ) : pos.data.map(po => (
                            <TableRow key={po.id}>
                                <TableCell className="px-4 py-3 font-semibold text-primary">{po.po_number}</TableCell>
                                <TableCell className="px-4 py-3 text-muted-foreground">{new Date(po.created_at).toLocaleDateString()}</TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="font-semibold text-foreground">{po.supplier?.name}</div>
                                    <div className="text-[12px] text-muted-foreground">{po.supplier?.email}</div>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-right font-bold text-destructive">₱{Number(po.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="px-4 py-3 text-center text-muted-foreground">{po.items?.length || 0} items</TableCell>
                                <TableCell className="px-4 py-3 text-center"><StatusBadge status={po.status} /></TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                    <Button size="sm" onClick={() => setViewPo(po)}>Review</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={pos.total} perPage={15} onChange={setPage} />

            <Modal 
                isOpen={!!viewPo} 
                onClose={() => setViewPo(null)} 
                title={`Purchase Order - ${viewPo?.po_number}`} 
                size="xl"
            >
                {viewPo && (
                    <div className="space-y-5">
                        {/* Header info */}
                        <Card className="bg-secondary/50 p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                                        <Package className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Logistics Partner</div>
                                        <div className="font-bold text-lg text-foreground tracking-tight">{viewPo.supplier?.name}</div>
                                        <div className="text-sm font-semibold text-primary">{viewPo.supplier?.email}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</div>
                                    <StatusBadge status={viewPo.status} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Authorizing Agent</div>
                                    <div className="font-bold text-foreground">{viewPo.creator?.name || 'System'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Creation Date</div>
                                    <div className="font-semibold text-foreground">{new Date(viewPo.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                </div>
                                {viewPo.expected_date && (
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Target Fulfillment</div>
                                        <div className="font-bold text-primary">{new Date(viewPo.expected_date).toLocaleDateString()}</div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Items table */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-foreground">Itemized Purchase Inventory</h3>
                                <Badge variant="secondary" className="uppercase">{viewPo.items?.length || 0} Line Items</Badge>
                            </div>
                            <Card className="overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">Product / Barcode</TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-center">Qty</TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-right">Unit Rate</TableHead>
                                            <TableHead className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-right">Total Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewPo.items?.map(i => {
                                            const productName = i.product?.name || i.supplier_product?.name || 'Loading Name...';
                                            const barcode = i.product?.barcode || i.supplier_product?.barcode || 'N/A';
                                            return (
                                                <TableRow key={i.id}>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="font-bold text-foreground mb-0.5">{productName}</div>
                                                        <Badge variant="outline" className="font-mono text-[11px]">Barcode: {barcode}</Badge>
                                                        {i.product_variant && (
                                                            <div className="text-[11px] text-primary font-bold mt-1">
                                                                ({[i.product_variant.size_value?.label, i.product_variant.color_value?.label].filter(Boolean).join(' ')})
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-center font-bold text-lg text-foreground">{i.quantity}</TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-muted-foreground font-semibold">
                                                        ₱{Number(i.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right font-bold text-foreground">
                                                        ₱{Number(i.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={3} className="px-4 py-4 text-right font-bold text-muted-foreground">Purchase Order Value:</TableCell>
                                            <TableCell className="px-4 py-4 text-right font-black text-xl text-primary">
                                                ₱{Number(viewPo.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </Card>
                        </div>

                        {/* Rejection reason */}
                        {viewPo.status === 'rejected' && viewPo.rejection_reason && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1">Supplier Rejection Reason</div>
                                    <div className="text-sm">{viewPo.rejection_reason}</div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">System Integrity Verified</span>
                            <div className="flex gap-2">
                                {viewPo.status === 'pending' && (
                                    <>
                                        <Button 
                                            disabled={actionLoading} 
                                            onClick={() => confirmAction(viewPo.id, 'approve')}
                                            className="shadow-md shadow-primary/20"
                                        >
                                            Authorize PO
                                        </Button>
                                        <Button 
                                            variant="outline"
                                            className="border-destructive/30 text-destructive hover:bg-destructive/5"
                                            disabled={actionLoading} 
                                            onClick={() => confirmAction(viewPo.id, 'decline')}
                                        >
                                            Decline Request
                                        </Button>
                                    </>
                                )}

                                {viewPo.status === 'supplier_delivered' && (
                                    <Button 
                                        disabled={actionLoading} 
                                        onClick={() => confirmAction(viewPo.id, 'receive')}
                                        className="shadow-md shadow-primary/20"
                                    >
                                        Confirm & Add to Stock
                                    </Button>
                                )}

                                {['pending_supplier', 'accepted'].includes(viewPo.status) && (
                                    <Badge variant="outline" className="gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">
                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                        Awaiting Fulfillment
                                    </Badge>
                                )}

                                {viewPo.status === 'received' && (
                                    <Badge variant="outline" className="gap-2 px-4 py-2.5 text-[11px] font-bold uppercase border-success/30 bg-success-light text-success-foreground">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Inventory Synchronized
                                    </Badge>
                                )}

                                {viewPo.status === 'cancelled' && (
                                    <Badge variant="outline" className="gap-2 px-4 py-2.5 text-[11px] font-bold uppercase border-destructive/30 bg-destructive/5 text-destructive">
                                        <XCircle className="h-3.5 w-3.5" />
                                        Request Voided
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
