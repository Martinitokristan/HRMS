import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { StatusBadge } from "../shared/Badge";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Package, Phone, Star, XCircle, Rocket, User, AlertTriangle, RotateCcw, Map, Navigation, ChevronDown } from 'lucide-react';
import CustomerOrderTracking from './CustomerOrderTracking';
import { useToast } from '../../context/ToastContext';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

const CANCEL_REASONS = [
    { value: 'changed_mind', label: 'Changed my mind' },
    { value: 'wrong_item', label: 'Ordered wrong item' },
    { value: 'duplicate_order', label: 'Duplicate order' },
    { value: 'price_issue', label: 'Price issue' },
    { value: 'found_better', label: 'Found better alternative' },
    { value: 'too_long', label: 'Taking too long' },
    { value: 'other', label: 'Other' },
];

const RETURN_REASONS = [
    { value: 'defective', label: 'Defective Product' },
    { value: 'wrong_item', label: 'Wrong Item Received' },
    { value: 'damaged', label: 'Damaged in Transit' },
    { value: 'not_as_described', label: 'Not as Described' },
    { value: 'missing_parts', label: 'Missing Parts' },
    { value: 'other', label: 'Other' },
];

export default function OrderHistory() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ratingOrder, setRatingOrder] = useState(null);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingHover, setRatingHover] = useState(0);
    const [ratingComment, setRatingComment] = useState("");
    const [submittingRating, setSubmittingRating] = useState(false);
    const [cancellingId, setCancellingId] = useState(null);
    const [cancelModal, setCancelModal] = useState({ show: false, order: null });
    const [cancelReason, setCancelReason] = useState('');
    const [cancelNotes, setCancelNotes] = useState('');
    const [returnModal, setReturnModal] = useState({ show: false, order: null });
    const [returnReason, setReturnReason] = useState('');
    const [returnDetails, setReturnDetails] = useState('');
    const [returnItems, setReturnItems] = useState([]);
    const [submittingReturn, setSubmittingReturn] = useState(false);
    const [visibleTrackers, setVisibleTrackers] = useState({}); // Tracking which order maps are visible
    const [expandedOrders, setExpandedOrders] = useState({}); // Tracking which orders are expanded

    const { refreshTrigger } = useSilentRefresh('customer_orders');

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

    const toggleTracker = (orderId) => {
        setVisibleTrackers(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const toggleOrder = (orderId) => {
        setExpandedOrders(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get("/customer/orders");
            setOrders(res.data?.data || res.data || []);
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
            fetchData(orders.length > 0);
        }, 400);

        // Real-time polling for status updates
        const interval = setInterval(() => {
            if (!isMounted) return;
            fetchData(true); // Fetch in background without showing spinner
        }, 5000); // Poll every 5 seconds for snappier updates

        return () => {
            clearTimeout(debounce);
            clearInterval(interval);
            isMounted = false;
        };
    }, [refreshTrigger]);

    const openCancelModal = (order) => {
        setCancelModal({ show: true, order });
        setCancelReason('');
        setCancelNotes('');
    };

    const closeCancelModal = () => {
        setCancelModal({ show: false, order: null });
        setCancelReason('');
        setCancelNotes('');
    };

    const handleCancelOrder = async () => {
        if (!cancelModal.order || !cancelReason) return;
        const orderId = cancelModal.order.id;
        setCancellingId(orderId);
        try {
            await axios.post(`/customer/orders/${orderId}/cancel`, {
                reason: cancelReason,
                notes: cancelNotes || null,
            });
            toast.success("Order cancelled successfully");
            markStale('customer_shop', 'admin_sales', 'admin_dashboard', 'customer_orders', 'admin_stock');
            fetchData(true);
            closeCancelModal();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to cancel order");
        } finally {
            setCancellingId(null);
        }
    };

    const openReturnModal = (order) => {
        setReturnModal({ show: true, order });
        setReturnReason('');
        setReturnDetails('');
        setReturnItems((order.items || []).map(item => ({
            sale_item_id: item.id,
            product_name: item.product?.name || 'Product',
            quantity: item.quantity,
            max_quantity: item.quantity,
            selected: true,
        })));
    };

    const closeReturnModal = () => {
        setReturnModal({ show: false, order: null });
        setReturnReason('');
        setReturnDetails('');
        setReturnItems([]);
    };

    const handleSubmitReturn = async () => {
        if (!returnModal.order || !returnReason) return;
        const selectedItems = returnItems.filter(i => i.selected && i.quantity > 0);
        if (selectedItems.length === 0) { toast.error('Please select at least one item to return'); return; }

        setSubmittingReturn(true);
        try {
            await axios.post('/customer/returns', {
                sale_id: returnModal.order.id,
                reason: returnReason,
                reason_details: returnDetails || null,
                items: selectedItems.map(i => ({ sale_item_id: i.sale_item_id, quantity: i.quantity })),
            });
            toast.success('Return request submitted successfully! You will be notified when it is reviewed.');
            markStale('customer_orders', 'admin_dashboard', 'admin_sales');
            fetchData(true);
            closeReturnModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit return request');
        } finally {
            setSubmittingReturn(false);
        }
    };

    const handleSubmitRating = async () => {
        if (!ratingOrder || ratingValue === 0) return;
        setSubmittingRating(true);
        try {
            await axios.post(`/deliveries/${ratingOrder.delivery.id}/rate`, {
                rating: ratingValue,
                comment: ratingComment,
            });
            toast.success("Rating submitted successfully");
            markStale('customer_orders', 'rider_dashboard');
            fetchData(true);
            setRatingOrder(null);
            setRatingValue(0);
            setRatingComment("");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to submit rating");
        } finally {
            setSubmittingRating(false);
        }
    };

    const STATUS_MAP = {
        pending: { label: "Pending", color: "#eab308", step: 0, badge: "bg-yellow-50 text-yellow-700 border-yellow-200" },
        confirmed: { label: "Confirmed", color: "#3b82f6", step: 1, badge: "bg-blue-50 text-blue-700 border-blue-100" },
        out_for_delivery: { label: "Out for Delivery", color: "#3b82f6", step: 2, badge: "bg-blue-50 text-blue-700 border-blue-100" },
        delivered: { label: "Delivered", color: "#10b981", step: 3, badge: "bg-green-50 text-green-700 border-green-200" },
        returned: { label: "Returned", color: "#ef4444", step: -1, badge: "bg-red-50 text-red-700 border-red-200" },
        cancelled: { label: "Cancelled", color: "#ef4444", step: -1, badge: "bg-red-100 text-red-800 border-red-200" },
    };

    const steps = [
        { key: "pending", label: "Ordered" },
        { key: "confirmed", label: "Confirmed" },
        { key: "out_for_delivery", label: "In Transit" },
        { key: "delivered", label: "Arrived" },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-secondary/30">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-secondary/30 py-12 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-foreground mb-1 tracking-tight">My Orders</h1>
                        <p className="text-muted-foreground">Track and manage your purchase history.</p>
                    </div>
                    <Link to="/shop" className="text-sm font-bold text-primary no-underline flex items-center gap-1.5 hover:underline">
                        <ArrowLeft className="h-4 w-4" /> Back to Shopping
                    </Link>
                </div>

                {orders.length === 0 ? (
                    <Card className="text-center py-16 px-8 rounded-3xl">
                        <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <h2 className="text-xl font-bold text-foreground mb-2">No orders yet</h2>
                        <p className="text-muted-foreground mb-6">When you place an order, it will appear here.</p>
                        <Button onClick={() => navigate("/shop")}>Start Shopping</Button>
                    </Card>
                ) : (
                    <div className="flex flex-col gap-3">
                        {orders.map((order) => {
                            const currentStatus = STATUS_MAP[order.status] || STATUS_MAP.pending;
                            const currentStep = currentStatus.step;
                            const isDelivered = order.status === 'delivered';
                            const isPending = order.status === 'pending';
                            const isCancelled = order.status === 'cancelled';
                            const isReturned = order.status === 'returned';
                            const hasRating = order.delivery?.rating;
                            const isExpanded = expandedOrders[order.id];
                            
                            const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
                            const otherItemsCount = order.items ? order.items.length - 1 : 0;

                            return (
                                <Card
                                    key={order.id}
                                    className={`overflow-hidden rounded-[2rem] border border-border shadow-sm transition-all duration-300 ${isCancelled ? 'opacity-60 grayscale-[0.3]' : ''} ${isExpanded ? 'ring-2 ring-primary/10 shadow-xl scale-[1.01]' : 'hover:border-primary/20 hover:shadow-md'}`}
                                >
                                    {/* COMPACT COLLAPSED ROW */}
                                    <div 
                                        className={`p-4 md:p-6 cursor-pointer flex items-center gap-4 transition-colors ${isExpanded ? 'bg-primary/[0.02]' : 'bg-white hover:bg-secondary/10'}`}
                                        onClick={() => toggleOrder(order.id)}
                                    >
                                        {/* Status Dot */}
                                        <div className="flex-shrink-0 w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: currentStatus.color }} />
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className="text-[11px] font-black text-foreground uppercase tracking-wider">#{order.order_number}</span>
                                                <Badge 
                                                    variant="outline" 
                                                    className={`text-[9px] font-black uppercase px-2 py-0 h-5 border shadow-none ${currentStatus.badge}`}
                                                >
                                                    {currentStatus.label}
                                                </Badge>
                                                {isDelivered && !hasRating && (
                                                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest animate-pulse">
                                                        · Rate now
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-bold truncate">
                                                <span className="truncate">
                                                    {firstItem ? `${Number(firstItem.quantity)}x ${firstItem.product?.name}` : 'Order Summary'} 
                                                    {otherItemsCount > 0 ? ` +${otherItemsCount} more` : ''}
                                                </span>
                                                <span className="text-gray-300">|</span>
                                                <span className="whitespace-nowrap">
                                                    {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right ml-4">
                                            <div className="text-sm font-black text-foreground">₱{Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                            <div className="text-[10px] font-black text-muted-foreground uppercase">{order.items?.length} {order.items?.length === 1 ? 'Item' : 'Items'}</div>
                                        </div>

                                        <div className={`ml-2 transform transition-transform duration-300 text-muted-foreground ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown className="h-5 w-5" />
                                        </div>
                                    </div>

                                    {/* EXPANDED CONTENT */}
                                    {isExpanded && (
                                        <div className="px-6 pb-8 pt-2 border-t border-dashed border-border/60 animate-in fade-in slide-in-from-top-2 duration-300">
                                            
                                            {/* Progress Tracker - Only show for active orders */}
                                            {currentStep >= 0 && !isDelivered && !isCancelled && !isReturned && (
                                                <div className="py-8 px-4 mb-8 bg-secondary/10 rounded-[1.5rem]">
                                                    <div className="flex justify-between relative">
                                                        <div className="absolute top-2.5 left-[12%] right-[12%] h-[2px] bg-border z-0" />
                                                        <div className="absolute top-2.5 left-[12%] h-[2px] bg-primary z-[1] transition-all duration-700 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                                                             style={{ width: `${(currentStep / (steps.length - 1)) * 76}%` }} />
                                                        
                                                        {steps.map((step, idx) => (
                                                            <div key={idx} className="relative z-[2] text-center w-1/4">
                                                                <div className={`w-5 h-5 rounded-full mx-auto mb-2.5 flex items-center justify-center text-[8px] transition-all duration-500
                                                                    ${idx <= currentStep ? 'bg-primary text-white ring-8 ring-primary/5' : 'bg-white border-2 border-border'}`}>
                                                                    {idx < currentStep ? "✓" : ""}
                                                                </div>
                                                                <span className={`text-[9px] uppercase tracking-widest ${idx <= currentStep ? 'font-black text-foreground' : 'font-bold text-muted-foreground'}`}>
                                                                    {step.label}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Cancelled/Returned Banner simplified */}
                                            {(isCancelled || isReturned) && (
                                                <div className={`p-4 mb-6 rounded-2xl flex items-center gap-3 border ${isCancelled ? 'bg-red-50 border-red-100 text-red-900' : 'bg-orange-50 border-orange-100 text-orange-900'}`}>
                                                    <AlertTriangle className="h-5 w-5 shrink-0" />
                                                    <div className="text-xs font-bold leading-tight">
                                                        {isCancelled ? `Order Cancelled: ${order.cancellation_reason ? CANCEL_REASONS.find(r => r.value === order.cancellation_reason)?.label || order.cancellation_reason : 'No reason provided'}` : 'Order has been returned'}
                                                        {order.cancellation_notes && <div className="mt-1 font-medium opacity-70 italic text-[10px]">"{order.cancellation_notes}"</div>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Rider Component with Inline Rating */}
                                            {order.delivery?.rider && (
                                                <div className="flex items-center gap-4 py-4 px-5 bg-primary/5 rounded-[1.5rem] border border-primary/10 mb-6">
                                                    <div className="relative flex-shrink-0">
                                                        <img
                                                            src={order.delivery.rider.photo ? (order.delivery.rider.photo.startsWith('http') ? order.delivery.rider.photo : `/storage/${order.delivery.rider.photo}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(order.delivery.rider.name)}&background=6366f1&color=fff&size=80`}
                                                            alt={order.delivery.rider.name}
                                                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                                                        />
                                                        <div className="absolute top-0 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                                    </div>
                                                    <div className="flex-1 flex items-center justify-between min-w-0">
                                                        <div>
                                                            <div className="text-xs font-black text-gray-900 leading-none mb-1">{order.delivery.rider.name}</div>
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                                Delivery Rider
                                                                {hasRating && (
                                                                    <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                                                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                                                        <span className="text-[9px] font-black">{order.delivery.rating}/5</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {!isDelivered && !isCancelled && (
                                                                <a href={`tel:${order.delivery.rider.phone}`} className="h-9 px-4 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95">
                                                                    <Phone className="h-3.5 w-3.5 shadow-xl" />
                                                                    Call
                                                                </a>
                                                            )}
                                                            {['accepted', 'in_progress', 'out_for_delivery'].includes(order.delivery.status) && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleTracker(order.id); }}
                                                                    className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all ${visibleTrackers[order.id] ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:border-primary/30'}`}
                                                                >
                                                                    {visibleTrackers[order.id] ? <XCircle className="h-4 w-4" /> : <Map className="h-4 w-4" />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Live Order Tracking Map Inline */}
                                            {order.delivery && order.delivery.rider && visibleTrackers[order.id] && (
                                                <div className="mb-6 rounded-[1.5rem] overflow-hidden border border-border bg-slate-100 h-64 shadow-inner">
                                                    <CustomerOrderTracking delivery={order.delivery} />
                                                </div>
                                            )}

                                            {/* Price Breakdown */}
                                            <div className="mb-8 px-4 space-y-2 border-l-2 border-primary/20 ml-2">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    <span>Subtotal (Net)</span>
                                                    <span>₱{Number(order.items?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                {order.discount_pct > 0 && (
                                                    <div className="flex justify-between items-center text-[10px] font-black text-green-600 uppercase tracking-widest">
                                                        <span>Discount ({order.discount_pct}%)</span>
                                                        <span>-₱{Number((order.items?.reduce((sum, item) => sum + Number(item.subtotal), 0) * (order.discount_pct / 100)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    <span>Vat (12%)</span>
                                                    <span>₱{Number(order.total_amount - (order.items?.reduce((sum, item) => sum + Number(item.subtotal), 0) * (1 - (order.discount_pct || 0) / 100))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="pt-2 flex justify-between items-center text-sm font-black text-foreground">
                                                    <span className="uppercase tracking-[0.2em] text-[10px]">Grand Total</span>
                                                    <span className="text-primary">₱{Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>

                                            {/* Expanded Panel Actions Footer */}
                                            <div className="flex flex-wrap gap-2 justify-center pt-6 mt-6 border-t border-dashed border-border/60">
                                                {/* Only for Pending Orders */}
                                                {isPending && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-[10px] font-black uppercase text-red-500 hover:text-red-600 hover:bg-red-50 tracking-widest h-10 px-6"
                                                        onClick={(e) => { e.stopPropagation(); openCancelModal(order); }}
                                                        disabled={cancellingId === order.id}
                                                    >
                                                        {cancellingId === order.id ? "Cancelling..." : "Cancel Order"}
                                                    </Button>
                                                )}

                                                {/* Only for Delivered Orders */}
                                                {isDelivered && (
                                                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                                        {!order.has_return && (
                                                            <Button
                                                                variant="outline"
                                                                className="flex-1 md:flex-none h-10 px-6 rounded-xl border-amber-200 text-amber-700 bg-amber-50/30 hover:bg-amber-50 text-[10px] font-black uppercase tracking-widest"
                                                                onClick={(e) => { e.stopPropagation(); openReturnModal(order); }}
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                                                Return
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            className="flex-1 md:flex-none h-10 px-6 rounded-xl border-blue-200 text-blue-700 bg-blue-50/30 hover:bg-blue-50 text-[10px] font-black uppercase tracking-widest"
                                                            onClick={(e) => { 
                                                                e.stopPropagation();
                                                                if (order.items && order.items.length > 0) {
                                                                    const item = order.items[0];
                                                                    const url = item.product_variant_id
                                                                        ? `/shop/products/${item.product_id}/reviews#write?variant=${item.product_variant_id}`
                                                                        : `/shop/products/${item.product_id}/reviews#write`;
                                                                    window.location.href = url;
                                                                }
                                                            }}
                                                        >
                                                            <Star className="h-3.5 w-3.5 mr-2" />
                                                            Review
                                                        </Button>
                                                        {!hasRating && order.delivery && (
                                                            <Button 
                                                                className="flex-1 md:flex-none h-10 px-8 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 text-[10px] font-black uppercase tracking-[0.15em]" 
                                                                onClick={(e) => { e.stopPropagation(); setRatingOrder(order); setRatingValue(0); setRatingComment(""); }}
                                                            >
                                                                Rate Delivery
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Sub-footer Line for tracking and payment */}
                                            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2 py-4 bg-secondary/20 rounded-2xl border border-secondary/30">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Tracking:</span>
                                                    <span className="text-[9px] font-black text-primary uppercase select-all">
                                                        {order.delivery?.tracking_number || "Awaiting Assignment"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Payment:</span>
                                                    <span className="text-[9px] font-black text-foreground uppercase">
                                                        {order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method === 'gcash' ? 'GCash' : order.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Direct Payment'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Rating Modal */}
            {ratingOrder && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setRatingOrder(null)}>
                    <Card className="max-w-md w-full p-8 text-center rounded-3xl" onClick={(e) => e.stopPropagation()}>
                        <Star className="h-12 w-12 mx-auto text-amber-400 fill-amber-400 mb-4" />
                        <h3 className="text-xl font-extrabold text-foreground mb-1">Rate Your Delivery</h3>
                        <p className="text-muted-foreground text-sm mb-6">Order #{ratingOrder.order_number}</p>

                        {/* Star Rating */}
                        <div className="flex justify-center gap-2 mb-4">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    onClick={() => setRatingValue(star)}
                                    onMouseEnter={() => setRatingHover(star)}
                                    onMouseLeave={() => setRatingHover(0)}
                                    className={`text-4xl border-none bg-transparent cursor-pointer transition-all p-1 ${star <= (ratingHover || ratingValue) ? 'text-amber-400 scale-110' : 'text-gray-300 scale-100'}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>

                        {ratingValue > 0 && (
                            <div className="text-sm font-semibold text-primary mb-4">
                                {ratingValue === 1 ? "Poor" : ratingValue === 2 ? "Fair" : ratingValue === 3 ? "Good" : ratingValue === 4 ? "Very Good" : "Excellent!"}
                            </div>
                        )}

                        <Textarea
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            placeholder="Tell us about your experience (optional)"
                            rows={3}
                            className="mb-6 resize-none"
                        />

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setRatingOrder(null)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSubmitRating} disabled={ratingValue === 0 || submittingRating}>
                                {submittingRating ? "Submitting..." : "Submit Rating"}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Cancel Order Modal */}
            {cancelModal.show && cancelModal.order && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeCancelModal}>
                    <Card className="max-w-md w-full p-8 rounded-3xl" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-3" />
                            <h3 className="text-xl font-extrabold text-foreground mb-1">Cancel Order</h3>
                            <p className="text-muted-foreground text-sm">Order #{cancelModal.order.order_number}</p>
                        </div>

                        <div className="mb-4">
                            <label className="text-sm font-bold text-foreground block mb-2">Why are you cancelling? <span className="text-destructive">*</span></label>
                            <div className="space-y-2">
                                {CANCEL_REASONS.map((reason) => (
                                    <label
                                        key={reason.value}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cancelReason === reason.value
                                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                : 'border-border hover:border-primary/30 hover:bg-secondary/30'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="cancel_reason"
                                            value={reason.value}
                                            checked={cancelReason === reason.value}
                                            onChange={(e) => setCancelReason(e.target.value)}
                                            className="accent-primary"
                                        />
                                        <span className="text-sm font-medium text-foreground">{reason.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {cancelReason === 'other' && (
                            <div className="mb-4">
                                <label className="text-sm font-bold text-foreground block mb-2">Additional details</label>
                                <Textarea
                                    value={cancelNotes}
                                    onChange={(e) => setCancelNotes(e.target.value)}
                                    placeholder="Please tell us more about why you're cancelling..."
                                    rows={3}
                                    className="resize-none"
                                />
                            </div>
                        )}

                        <Card className="bg-amber-50 border-amber-200 p-3 mb-6">
                            <p className="text-xs text-amber-800">
                                <span className="font-bold">Note:</span> Cancelling this order will restore the stock and you will not be charged. This action cannot be undone.
                            </p>
                        </Card>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={closeCancelModal}>
                                Keep Order
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1 font-bold"
                                onClick={handleCancelOrder}
                                disabled={!cancelReason || cancellingId === cancelModal.order.id}
                            >
                                {cancellingId === cancelModal.order.id ? "Cancelling..." : "Confirm Cancel"}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Return Request Modal */}
            {returnModal.show && returnModal.order && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeReturnModal}>
                    <Card className="max-w-lg w-full p-8 rounded-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <RotateCcw className="h-12 w-12 mx-auto text-amber-500 mb-3" />
                            <h3 className="text-xl font-extrabold text-foreground mb-1">Request Return</h3>
                            <p className="text-muted-foreground text-sm">Order #{returnModal.order.order_number}</p>
                        </div>

                        {/* Select items to return */}
                        <div className="mb-4">
                            <label className="text-sm font-bold text-foreground block mb-2">Items to Return</label>
                            <div className="space-y-2">
                                {returnItems.map((item, idx) => (
                                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${item.selected ? 'border-primary bg-primary/5' : 'border-border'
                                        }`}>
                                        <input
                                            type="checkbox"
                                            checked={item.selected}
                                            onChange={(e) => {
                                                const updated = [...returnItems];
                                                updated[idx].selected = e.target.checked;
                                                setReturnItems(updated);
                                            }}
                                            className="accent-primary"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-foreground truncate block">{item.product_name}</span>
                                        </div>
                                        {item.selected && (
                                            <div className="flex items-center gap-1">
                                                <label className="text-xs text-muted-foreground">Qty:</label>
                                                <select
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const updated = [...returnItems];
                                                        updated[idx].quantity = parseInt(e.target.value);
                                                        setReturnItems(updated);
                                                    }}
                                                    className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                                                >
                                                    {Array.from({ length: item.max_quantity }, (_, i) => i + 1).map(q => (
                                                        <option key={q} value={q}>{q}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Reason */}
                        <div className="mb-4">
                            <label className="text-sm font-bold text-foreground block mb-2">Reason for Return <span className="text-destructive">*</span></label>
                            <div className="space-y-2">
                                {RETURN_REASONS.map((reason) => (
                                    <label
                                        key={reason.value}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${returnReason === reason.value
                                                ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-200'
                                                : 'border-border hover:border-amber-300 hover:bg-secondary/30'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="return_reason"
                                            value={reason.value}
                                            checked={returnReason === reason.value}
                                            onChange={(e) => setReturnReason(e.target.value)}
                                            className="accent-amber-500"
                                        />
                                        <span className="text-sm font-medium text-foreground">{reason.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="mb-4">
                            <label className="text-sm font-bold text-foreground block mb-2">Additional Details</label>
                            <Textarea
                                value={returnDetails}
                                onChange={(e) => setReturnDetails(e.target.value)}
                                placeholder="Describe the issue in detail..."
                                rows={3}
                                className="resize-none"
                            />
                        </div>

                        <Card className="bg-blue-50 border-blue-200 p-3 mb-6">
                            <p className="text-xs text-blue-800">
                                <span className="font-bold">Note:</span> Your return request will be reviewed by our team. You will receive a notification once it is approved or rejected. If approved, a refund will be processed.
                            </p>
                        </Card>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={closeReturnModal}>
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 font-bold bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={handleSubmitReturn}
                                disabled={!returnReason || returnItems.filter(i => i.selected).length === 0 || submittingReturn}
                            >
                                {submittingReturn ? "Submitting..." : "Submit Return Request"}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            <style>{`
                .spinner {
                    width: 40px; height: 40px;
                    border: 4px solid hsl(var(--border));
                    border-top: 4px solid hsl(var(--primary));
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
