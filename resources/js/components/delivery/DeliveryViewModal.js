import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import Modal from '../shared/Modal';
import { StatusBadge } from '../shared/Badge';

export default function DeliveryViewModal({ isOpen, onClose, deliveryId }) {
    const { showToast } = useToast();
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !deliveryId) return;
        
        let isMounted = true;
        setLoading(true);
        axios.get(`/deliveries/${deliveryId}`)
            .then(res => {
                if (isMounted) {
                    setDelivery(res.data.data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    showToast('Failed to load delivery details', 'error');
                    setLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [isOpen, deliveryId]);

    if (!isOpen) return null;

    const formatCurrency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);
    const formatTime = (date) => date ? new Date(date).toLocaleString() : '-';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Delivery ${delivery?.tracking_number || ''}`} size="lg">
            {loading ? (
                <div className="py-4 text-center"><div className="spinner" /></div>
            ) : delivery ? (
                <div>
                    <div className="grid grid-2 gap-4 mb-5 border-radius-lg p-3 bg-surface2">
                        <div>
                            <div className="text-xs font-bold text-muted uppercase mb-2">Customer Info</div>
                            <h3 className="font-bold text-xl mb-2 text-primary">{delivery.sale?.customer?.name || 'Walk-in Customer'}</h3>
                            
                            <div className="info-group mb-2">
                                <label className="text-xs font-bold text-muted uppercase d-block">Contact Phone</label>
                                <div className="font-semi text-md">{delivery.sale?.customer?.phone || 'N/A'}</div>
                            </div>
                            
                            <div className="info-group">
                                <label className="text-xs font-bold text-muted uppercase d-block">Delivery Address</label>
                                <div className="text-sm font-semi italic">{delivery.address || 'No address provided'}</div>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-muted uppercase mb-2">Delivery Status</div>
                            <div className="d-flex align-center justify-between mb-2">
                                <span className="text-sm font-bold">Status:</span>
                                <StatusBadge status={delivery.status} />
                            </div>
                            <div className="d-flex align-center justify-between mb-2">
                                <span className="text-sm font-bold">Assigned Rider:</span>
                                <span className="font-bold text-primary">{delivery.rider ? delivery.rider.name : 'Unassigned'}</span>
                            </div>
                            <div className="d-flex align-center justify-between mb-2">
                                <span className="text-sm font-bold">Order Reference:</span>
                                <span className="font-bold">#{delivery.sale?.order_number}</span>
                            </div>
                            <div className="d-flex align-center justify-between mt-3 pt-3 border-top">
                                <span className="text-sm font-bold text-muted">Amount Due:</span>
                                <div>
                                    <span className="text-xl font-bold text-accent">
                                        {formatCurrency(delivery.sale?.total_amount)}
                                    </span>
                                    {delivery.sale?.payment_method === 'cod' && <span className="badge badge--amber ms-2">COD</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <h4 className="text-xs font-bold text-muted uppercase mb-3 px-1">Order Items</h4>
                    <div className="table-wrap mb-5 border-radius-lg">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th className="text-center">Qty</th>
                                    <th className="text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!delivery.sale?.items || delivery.sale.items.length === 0 ? (
                                    <tr><td colSpan="3" className="text-center text-muted py-4">No items found in this order.</td></tr>
                                ) : (
                                    delivery.sale.items.map(item => (
                                        <tr key={item.id}>
                                            <td className="font-bold">{item.product?.name || 'Unknown Product'}</td>
                                            <td className="text-center font-semi">{parseFloat(item.quantity).toFixed(0)}</td>
                                            <td className="text-right font-bold">{formatCurrency(item.subtotal)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <h4 className="text-xs font-bold text-muted uppercase mb-3 px-1">Delivery Timeline</h4>
                    <div className="bg-surface2 p-4 border-radius-lg border">
                        <div className="grid grid-3 gap-3">
                            <div className="timeline-item">
                                <label className="text-xs font-bold text-muted uppercase d-block mb-1">Ordered At</label>
                                <div className="font-bold text-md">{formatTime(delivery.created_at)}</div>
                            </div>
                            <div className="timeline-item">
                                <label className="text-xs font-bold text-muted uppercase d-block mb-1">Picked Up At</label>
                                <div className="font-bold text-md text-blue">
                                    {delivery.pickup_at ? formatTime(delivery.pickup_at) : (delivery.status !== 'pending' ? 'Processing...' : 'Awaiting Pickup')}
                                </div>
                            </div>
                            <div className="timeline-item">
                                <label className="text-xs font-bold text-muted uppercase d-block mb-1">Delivered At</label>
                                <div className="font-bold text-md text-green">{formatTime(delivery.delivered_at)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4 text-muted">Failed to load delivery details.</div>
            )}
        </Modal>
    );
}
