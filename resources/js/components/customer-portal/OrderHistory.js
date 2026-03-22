import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { StatusBadge } from "../shared/Badge";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Package, Phone, Star, XCircle, Rocket, User, AlertTriangle, RotateCcw, Map, Navigation } from 'lucide-react';
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
        pending: { label: "Pending", color: "#eab308", step: 0 },
        confirmed: { label: "Confirmed", color: "#3b82f6", step: 1 },
        out_for_delivery: { label: "Out for Delivery", color: "#6366f1", step: 2 },
        delivered: { label: "Delivered", color: "#10b981", step: 3 },
        returned: { label: "Returned", color: "#ef4444", step: -1 },
        cancelled: { label: "Cancelled", color: "#6b7280", step: -1 },
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
            <div className="max-w-2xl mx-auto">
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
                    <div className="flex flex-col gap-8">
                        {orders.map((order) => {
                            const currentStatus = STATUS_MAP[order.status] || STATUS_MAP.pending;
                            const currentStep = currentStatus.step;
                            const isDelivered = order.status === 'delivered';
                            const isPending = order.status === 'pending';
                            const isCancelled = order.status === 'cancelled';
                            const hasRating = order.delivery?.rating;

                            return (
                                <Card
                                    key={order.id}
                                    className={`overflow-hidden rounded-3xl transition-all ${isCancelled ? 'opacity-70 border-destructive/30' : ''}`}
                                >
                                    {/* Order Header Card */}
                                    <div className={`p-6 border-b border-border ${isCancelled ? 'bg-destructive/5' : 'bg-secondary/30'}`}>
                                        <div className="flex justify-between items-start flex-wrap gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="text-xs font-extrabold text-primary uppercase tracking-widest">Order #{order.order_number}</span>
                                                    <StatusBadge status={order.status} />
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Purchased on {new Date(order.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </div>
                                                {order.delivery?.tracking_number && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        Tracking: <span className="font-bold text-primary">{order.delivery.tracking_number}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-black text-foreground">₱{Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                <div className="text-xs text-muted-foreground">{order.items?.length} Items Total</div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5 uppercase">
                                                    {order.payment_method === 'cod' ? 'COD' : order.payment_method === 'gcash' ? 'GCash' : order.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        {/* Delivery Tracker */}
                                        {currentStep >= 0 && (
                                            <div className="mb-8">
                                                <div className="flex justify-between relative mb-4">
                                                    <div className="absolute top-3 left-[10%] right-[10%] h-0.5 bg-border z-0" />
                                                    <div className="absolute top-3 left-[10%] h-0.5 bg-primary z-[1] transition-all duration-500" style={{ width: `${(currentStep / (steps.length - 1)) * 80}%` }} />
                                                    {steps.map((step, idx) => (
                                                        <div key={idx} className="relative z-[2] text-center w-1/4">
                                                            <div className={`w-6 h-6 rounded-full mx-auto mb-2 flex items-center justify-center text-[10px] transition-all ${idx <= currentStep ? 'bg-primary text-white ring-4 ring-primary/10' : 'bg-white border-2 border-border'
                                                                } ${idx === currentStep ? 'ring-4 ring-primary/20' : ''}`}>
                                                                {idx < currentStep ? "✓" : ""}
                                                            </div>
                                                            <span className={`text-xs ${idx <= currentStep ? 'font-extrabold text-foreground' : 'font-medium text-muted-foreground'}`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Cancelled Banner */}
                                        {isCancelled && (
                                            <Card className="bg-destructive/5 border-destructive/20 p-4 mb-6 flex items-center gap-3">
                                                <XCircle className="h-6 w-6 text-destructive shrink-0" />
                                                <div>
                                                    <div className="font-bold text-destructive text-sm">Order Cancelled</div>
                                                    {order.cancellation_reason && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Reason: {CANCEL_REASONS.find(r => r.value === order.cancellation_reason)?.label || order.cancellation_reason}
                                                        </div>
                                                    )}
                                                    {order.cancellation_notes && (
                                                        <div className="text-xs text-muted-foreground italic mt-0.5">"{order.cancellation_notes}"</div>
                                                    )}
                                                    {!order.cancellation_reason && (
                                                        <div className="text-xs text-muted-foreground">This order has been cancelled and stock has been restored.</div>
                                                    )}
                                                </div>
                                            </Card>
                                        )}

                                        {/* Rider Component */}
                                        {order.delivery?.rider && (
                                            <Card className="bg-primary/5 border-primary/10 p-5 flex items-center gap-4 mb-6">
                                                <div className="relative">
                                                    <img
                                                        src={order.delivery.rider.photo ? (order.delivery.rider.photo.startsWith('http') ? order.delivery.rider.photo : `/storage/${order.delivery.rider.photo}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(order.delivery.rider.name)}&background=6366f1&color=fff&size=80`}
                                                        alt={order.delivery.rider.name}
                                                        className="w-16 h-16 rounded-full object-cover border-3 border-white shadow-lg"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-primary text-sm">{order.delivery.rider.name}</div>
                                                    <div className="text-xs text-muted-foreground">Your delivery rider</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <a href={`tel:${order.delivery.rider.phone}`} className="bg-primary text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        Call
                                                    </a>
                                                </div>
                                            </Card>
                                        )}

                                        {/* Live Order Tracking Toggle Button */}
                                        {order.delivery && order.delivery.rider && ['accepted', 'in_progress', 'out_for_delivery'].includes(order.delivery.status) && (
                                            <div className="mb-4">
                                                <Button
                                                    variant={visibleTrackers[order.id] ? "default" : "secondary"}
                                                    size="sm"
                                                    onClick={() => toggleTracker(order.id)}
                                                    className="w-full flex items-center justify-center gap-2 rounded-xl py-5"
                                                >
                                                    {visibleTrackers[order.id] ? (
                                                        <>
                                                            <XCircle className="h-4 w-4" />
                                                            Hide Map Tracker
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Map className="h-4 w-4" />
                                                            Track Order Live
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}

                                        {/* Live Order Tracking Map */}
                                        {order.delivery && order.delivery.rider && ['accepted', 'in_progress', 'out_for_delivery'].includes(order.delivery.status) && visibleTrackers[order.id] && (
                                            <div className="mb-6 rounded-3xl overflow-hidden border border-border shadow-sm">
                                                <CustomerOrderTracking delivery={order.delivery} />
                                            </div>
                                        )}

                                        {/* Rating Display (already rated) */}
                                        {isDelivered && hasRating && (
                                            <Card className="bg-amber-50 border-amber-200 p-4 mb-6 flex items-center gap-3">
                                                <Star className="h-8 w-8 text-amber-500 fill-amber-500 shrink-0" />
                                                <div className="flex-1">
                                                    <div className="font-bold text-amber-800 text-sm mb-0.5">Your Rating: {order.delivery.rating}/5</div>
                                                    <div className="flex gap-0.5 mb-0.5">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <span key={star} className={`text-lg ${star <= order.delivery.rating ? 'text-amber-400' : 'text-gray-300'}`}>★</span>
                                                        ))}
                                                    </div>
                                                    {order.delivery.rating_comment && (
                                                        <div className="text-xs text-muted-foreground italic">"{order.delivery.rating_comment}"</div>
                                                    )}
                                                </div>
                                            </Card>
                                        )}

                                        {/* Rate Button (delivered but not yet rated) */}
                                        {isDelivered && !hasRating && order.delivery && (
                                            <div className="rounded-2xl p-6 mb-6 text-center bg-gradient-to-br from-indigo-500 to-purple-600">
                                                <div className="text-2xl mb-2">🌟</div>
                                                <div className="text-white font-bold text-lg mb-1">How was your delivery?</div>
                                                <div className="text-white/80 text-sm mb-4">Your feedback helps us improve our service</div>
                                                <Button variant="secondary" className="font-bold" onClick={() => { setRatingOrder(order); setRatingValue(0); setRatingComment(""); }}>
                                                    Rate Delivery
                                                </Button>
                                            </div>
                                        )}

                                        {/* Item List */}
                                        <Card className="bg-secondary/30 p-5 border-border">
                                            <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-4">Order Details</h4>
                                            <div className="space-y-3">
                                                {order.items?.map((item) => (
                                                    <div key={item.id} className="flex justify-between items-center">
                                                        <div>
                                                            <div className="text-sm font-bold text-foreground">{item.quantity}x {item.product?.name}</div>
                                                            {item.variants && Object.keys(item.variants).length > 0 && (
                                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                                    {Object.values(item.variants).filter(v => v?.label).map(v => v.label).join(", ")}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="font-bold text-foreground text-sm">₱{Number(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>

                                        {/* Cancel Button for pending orders */}
                                        {isPending && (
                                            <div className="mt-5 text-center">
                                                <Button
                                                    variant="outline"
                                                    className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive font-bold"
                                                    onClick={() => openCancelModal(order)}
                                                    disabled={cancellingId === order.id}
                                                >
                                                    Cancel Order
                                                </Button>
                                            </div>
                                        )}

                                        {/* Return Button for delivered orders */}
                                        {isDelivered && !order.has_return && (
                                            <div className="mt-5 text-center">
                                                <Button
                                                    variant="outline"
                                                    className="border-amber-400/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 font-bold"
                                                    onClick={() => openReturnModal(order)}
                                                >
                                                    <RotateCcw className="h-4 w-4 mr-2" />
                                                    Request Return
                                                </Button>
                                            </div>
                                        )}

                                        {/* Write Review Button for delivered orders */}
                                        {isDelivered && (
                                            <div className="mt-3 text-center">
                                                <Button
                                                    variant="outline"
                                                    className="border-blue-400/50 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-bold"
                                                    onClick={() => {
                                                        // Navigate to reviews page for the first product in the order
                                                        if (order.items && order.items.length > 0) {
                                                            const firstItem = order.items[0];
                                                            const url = firstItem.product_variant_id
                                                                ? `/shop/products/${firstItem.product_id}/reviews#write?variant=${firstItem.product_variant_id}`
                                                                : `/shop/products/${firstItem.product_id}/reviews#write`;
                                                            window.location.href = url;
                                                        }
                                                    }}
                                                >
                                                    <Star className="h-4 w-4 mr-2" />
                                                    Write Review
                                                </Button>
                                            </div>
                                        )}

                                        {/* Return Submitted Banner */}
                                        {order.has_return && order.status !== 'returned' && (
                                            <Card className="bg-amber-50 border-amber-200 p-4 mt-5 flex items-center gap-3">
                                                <RotateCcw className="h-5 w-5 text-amber-600 shrink-0" />
                                                <div>
                                                    <div className="font-bold text-amber-800 text-sm">Return Requested</div>
                                                    <div className="text-xs text-muted-foreground">Your return request is being reviewed by our team.</div>
                                                </div>
                                            </Card>
                                        )}

                                        {/* Returned Banner */}
                                        {order.status === 'returned' && (
                                            <Card className="bg-orange-50 border-orange-200 p-4 mt-5 flex items-center gap-3">
                                                <RotateCcw className="h-5 w-5 text-orange-600 shrink-0" />
                                                <div>
                                                    <div className="font-bold text-orange-800 text-sm">Order Returned</div>
                                                    <div className="text-xs text-muted-foreground">This order has been returned. Check your notifications for refund details.</div>
                                                </div>
                                            </Card>
                                        )}
                                    </div>
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
