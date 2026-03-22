// SupplierOrders.js - Supplier PO Management
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import Modal from '../shared/Modal';
import { StatusBadge } from '../shared/Badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function SupplierOrders() {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const highlightId = searchParams.get('id');
    const { refreshTrigger } = useSilentRefresh('supplier_orders');
    const [orders, setOrders] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(orders.data.length === 0);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        show: false, title: '', message: '',
        onConfirm: null, variant: 'default'
    });
    const showConfirm = (title, message, onConfirm, variant = 'default') => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };
    const closeConfirm = () => {
        setConfirmModal({
            show: false, title: '', message: '',
            onConfirm: null, variant: 'default'
        });
    };

    // Reject modal state
    const [rejectModal, setRejectModal] = useState(null); // holds the order to reject
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectError, setRejectError] = useState('');

    useEffect(() => {
        fetchOrders(orders.data.length > 0);
    }, [page, statusFilter, refreshTrigger]);

    useEffect(() => {
        if (highlightId && orders.data?.length > 0 && !selectedOrder) {
            const orderToOpen = orders.data.find(o => o.id == highlightId);
            if (orderToOpen) {
                setSelectedOrder(orderToOpen);
            }
        }
    }, [highlightId, orders.data]);

    const fetchOrders = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = { page, per_page: 15 };
            if (statusFilter) params.status = statusFilter;

            const res = await axios.get('/supplier/purchase-orders', { params });
            setOrders(res.data.data);
        } catch (err) {
            // Silently fail on background refresh
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const performAccept = async (order) => {
        closeConfirm();
        setSubmitting(true);
        try {
            await axios.post(`/supplier/purchase-orders/${order.id}/accept`);
            showToast(`PO ${order.po_number} accepted! You can now mark it as delivered when ready.`, 'success');
            markStale('supplier_orders', 'supplier_dashboard', 'admin_purchase');
            fetchOrders(true);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to accept PO', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAccept = (order) => {
        showConfirm(
            'Accept Purchase Order',
            `Accept PO ${order.po_number}? This confirms you have the stock available.`,
            () => performAccept(order)
        );
    };

    const openRejectModal = (order) => {
        setRejectModal(order);
        setRejectionReason('');
        setRejectError('');
    };

    const handleReject = async () => {
        if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
            setRejectError('Please provide a reason of at least 10 characters.');
            return;
        }
        setSubmitting(true);
        try {
            await axios.post(`/supplier/purchase-orders/${rejectModal.id}/reject`, {
                rejection_reason: rejectionReason.trim(),
            });
            showToast(`PO ${rejectModal.po_number} rejected. The admin has been notified.`, 'success');
            markStale('supplier_orders', 'supplier_dashboard', 'admin_purchase');
            setRejectModal(null);
            setRejectionReason('');
            fetchOrders(true);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to reject PO', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeliver = async () => {
        if (!selectedOrder) return;

        setSubmitting(true);
        try {
            await axios.post(`/supplier/purchase-orders/${selectedOrder.id}/deliver`, {
                delivery_notes: deliveryNotes
            });
            showToast('Order marked as delivered successfully!');
            markStale('supplier_orders', 'supplier_dashboard', 'admin_purchase');
            setSelectedOrder(null);
            setDeliveryNotes('');
            fetchOrders(true);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to mark as delivered', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { cls: '', label: 'Pending Admin Approval' },
            pending_supplier: { cls: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Awaiting Your Response' },
            accepted: { cls: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Accepted – Ready to Deliver' },
            rejected: { cls: 'bg-red-100 text-red-700 border-red-200', label: 'Rejected' },
            supplier_delivered: { cls: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Delivered' },
            received: { cls: 'bg-green-100 text-green-700 border-green-200', label: 'Received' },
        };
        const badge = badges[status] || badges.pending;
        return <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>;
    };

    const canAcceptOrReject = (status) => status === 'pending_supplier';
    const canDeliver = (status) => status === 'accepted';

    return (
        <div>
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-foreground">Purchase Orders</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Track and manage your purchase orders</p>
                </div>
            </div>

            {/* Filters */}
            <FilterBar
                filters={[
                    {
                        value: statusFilter,
                        onChange: setStatusFilter,
                        options: [
                            { value: '', label: 'All Statuses' },
                            { value: 'pending_supplier', label: 'Awaiting Your Response' },
                            { value: 'accepted', label: 'Accepted' },
                            { value: 'rejected', label: 'Rejected' },
                            { value: 'supplier_delivered', label: 'Delivered' },
                            { value: 'received', label: 'Received' },
                        ]
                    }
                ]}
            />

            {/* Orders Table */}
            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Total Amount</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8"><div className="spinner" /></TableCell></TableRow>
                        ) : orders.data?.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders found</TableCell></TableRow>
                        ) : orders.data?.map(order => (
                            <TableRow key={order.id}>
                                <TableCell className="font-semibold">{order.po_number}</TableCell>
                                <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>{getStatusBadge(order.status)}</TableCell>
                                <TableCell>{order.items?.length || 0} items</TableCell>
                                <TableCell className="font-bold">₱{Number(order.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell>
                                    <Button size="sm" onClick={() => setSelectedOrder(order)}>View Details</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Pagination
                page={page}
                total={orders.total}
                perPage={15}
                onChange={setPage}
            />

            {/* Reject PO Modal */}
            <Modal
                isOpen={!!rejectModal}
                onClose={() => !submitting && setRejectModal(null)}
                title={`Reject PO: ${rejectModal?.po_number}`}
                size="md"
            >
                {rejectModal && (
                    <div className="space-y-4">
                        <Card className="p-3 border-l-4 border-l-destructive bg-destructive/5">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                <div>
                                    <div className="font-semibold text-sm mb-0.5">You are rejecting this Purchase Order.</div>
                                    <div className="text-sm text-muted-foreground">The admin will be notified with your reason. This action cannot be undone.</div>
                                </div>
                            </div>
                        </Card>

                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Order Summary</div>
                            <div className="font-semibold text-foreground">{rejectModal.po_number} — {rejectModal.items?.length || 0} items</div>
                            <div className="text-sm text-muted-foreground">Total: ₱{Number(rejectModal.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                                Reason for Rejection <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                value={rejectionReason}
                                onChange={(e) => { setRejectionReason(e.target.value); setRejectError(''); }}
                                placeholder="e.g., We currently don't have sufficient stock for items requested. Please reorder in 2 weeks..."
                                rows={4}
                                className={rejectError ? 'border-destructive' : ''}
                            />
                            {rejectError && <div className="text-sm text-destructive">{rejectError}</div>}
                            <div className="text-xs text-muted-foreground">{rejectionReason.length} characters (minimum 10 required)</div>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setRejectModal(null)} disabled={submitting}>Cancel</Button>
                            <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={submitting}>
                                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Order Details / Deliver Modal */}
            <Modal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder?.action === 'deliver' ? 'Fulfillment Confirmation' : `Order Details - ${selectedOrder?.po_number}`}
                size="xl"
            >
                {selectedOrder && (
                    <div className="p-1">
                        {selectedOrder.action === 'deliver' ? (
                            <div className="space-y-4">
                                <h4 className="font-bold text-foreground">Confirm Dispatch</h4>
                                <p className="text-muted-foreground text-sm">You are marking order <strong className="text-foreground">{selectedOrder.po_number}</strong> as ready for delivery. Please confirm the items below are packed.</p>

                                <Card className="divide-y divide-border">
                                    {selectedOrder.items?.map(item => (
                                        <div key={item.id} className="flex justify-between items-center px-4 py-2.5">
                                            <span className="font-semibold text-sm">{item.product?.name || item.supplier_product?.name}</span>
                                            <span className="font-bold text-sm">× {item.quantity}</span>
                                        </div>
                                    ))}
                                </Card>

                                <div className="space-y-1.5">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Delivery Notes (Optional)</Label>
                                    <Textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Add any delivery details or tracking information..." rows={3} />
                                </div>

                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => setSelectedOrder(null)} disabled={submitting}>Back</Button>
                                    <Button className="flex-1" onClick={handleDeliver} disabled={submitting}>
                                        {submitting ? 'Processing...' : 'Confirm Delivery'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Header Info */}
                                <div className="flex justify-between items-start pb-4 border-b border-border">
                                    <div>
                                        <h2 className="text-lg font-bold text-foreground">Order {selectedOrder.po_number}</h2>
                                        <div className="text-sm text-muted-foreground">Issued on {new Date(selectedOrder.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Status</div>
                                        {getStatusBadge(selectedOrder.status)}
                                    </div>
                                </div>

                                {/* Bill To / Order Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h6 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Purchaser</h6>
                                        <div className="font-bold text-sm text-foreground">HRMS Central Warehouse</div>
                                        <div className="text-sm text-muted-foreground">Procurement Department</div>
                                    </div>
                                    <div className="text-right">
                                        <h6 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Order Information</h6>
                                        <div className="text-sm">PO Number: <strong>{selectedOrder.po_number}</strong></div>
                                        <div className="text-sm text-muted-foreground">Date: {new Date(selectedOrder.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>

                                {/* Table */}
                                <Card className="overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product Description</TableHead>
                                                <TableHead className="text-center">QTY</TableHead>
                                                <TableHead className="text-right">Unit Price</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedOrder.items?.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="font-bold text-sm text-foreground">{item.product?.name || item.supplier_product?.name}</div>
                                                        <div className="text-xs text-muted-foreground">Barcode: {item.product?.barcode || item.supplier_product?.barcode || 'N/A'}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-semibold">{item.quantity}</TableCell>
                                                    <TableCell className="text-right">₱{Number(item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="text-right font-bold">₱{Number(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="flex justify-end items-center px-4 py-3 border-t border-border bg-secondary/30">
                                        <span className="text-sm font-bold text-muted-foreground mr-4">Grand Total</span>
                                        <span className="text-lg font-extrabold text-primary">₱{Number(selectedOrder.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </Card>

                                {/* Notes/Reason */}
                                {selectedOrder.status === 'rejected' && selectedOrder.rejection_reason && (
                                    <Card className="p-3 bg-red-50 border-red-100">
                                        <div className="text-[10px] font-bold text-red-600 uppercase mb-1">Rejection Reason</div>
                                        <div className="text-sm text-foreground">{selectedOrder.rejection_reason}</div>
                                    </Card>
                                )}

                                {selectedOrder.delivery_notes && (
                                    <Card className="p-3 bg-blue-50 border-blue-100">
                                        <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">Delivery Notes</div>
                                        <div className="text-sm text-foreground italic">"{selectedOrder.delivery_notes}"</div>
                                    </Card>
                                )}

                                {/* Modal Footer Actions */}
                                <div className="border-t border-border pt-4 flex justify-end gap-3">
                                    {canAcceptOrReject(selectedOrder.status) && (
                                        <>
                                            <Button onClick={async () => { const o = selectedOrder; setSelectedOrder(null); await handleAccept(o); }} disabled={submitting}>Accept Order</Button>
                                            <Button variant="destructive" onClick={() => { const o = selectedOrder; setSelectedOrder(null); openRejectModal(o); }} disabled={submitting}>Decline Order</Button>
                                        </>
                                    )}
                                    {canDeliver(selectedOrder.status) && (
                                        <Button onClick={() => setSelectedOrder({ ...selectedOrder, action: 'deliver' })}>Mark as Delivered</Button>
                                    )}
                                    <Button variant="outline" onClick={() => setSelectedOrder(null)}>Close</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
