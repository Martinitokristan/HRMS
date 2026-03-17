import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { StatusBadge } from "../shared/Badge";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Package, Phone, Star, XCircle } from 'lucide-react';

export default function OrderHistory() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ratingOrder, setRatingOrder] = useState(null);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingHover, setRatingHover] = useState(0);
    const [ratingComment, setRatingComment] = useState("");
    const [submittingRating, setSubmittingRating] = useState(false);
    const [cancellingId, setCancellingId] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = () => {
        setLoading(true);
        axios
            .get("/customer/orders")
            .then((res) => setOrders(res.data.data))
            .finally(() => setLoading(false));
    };

    const handleCancelOrder = async (orderId) => {
        if (!window.confirm("Are you sure you want to cancel this order?")) return;
        setCancellingId(orderId);
        try {
            await axios.post(`/customer/orders/${orderId}/cancel`);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
        } catch (err) {
            alert(err.response?.data?.message || "Failed to cancel order");
        } finally {
            setCancellingId(null);
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
            // Update local state
            setOrders(prev => prev.map(o => {
                if (o.id === ratingOrder.id && o.delivery) {
                    return { ...o, delivery: { ...o.delivery, rating: ratingValue, rating_comment: ratingComment } };
                }
                return o;
            }));
            setRatingOrder(null);
            setRatingValue(0);
            setRatingComment("");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to submit rating");
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
                                                    {order.payment_method === 'cod' ? '💵 COD' : order.payment_method === 'gcash' ? '📱 GCash' : order.payment_method === 'bank_transfer' ? '🏦 Bank' : '💳 Cash'}
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
                                                            <div className={`w-6 h-6 rounded-full mx-auto mb-2 flex items-center justify-center text-[10px] transition-all ${
                                                                idx <= currentStep ? 'bg-primary text-white ring-4 ring-primary/10' : 'bg-white border-2 border-border'
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
                                                    <div className="text-xs text-muted-foreground">This order has been cancelled and stock has been restored.</div>
                                                </div>
                                            </Card>
                                        )}

                                        {/* Rider Component */}
                                        {order.delivery?.rider && (
                                            <Card className="bg-primary/5 border-primary/10 p-5 flex items-center gap-4 mb-6">
                                                <div className="relative">
                                                    <img
                                                        src={order.delivery.rider.photo ? (order.delivery.rider.photo.startsWith('http') ? order.delivery.rider.photo : `/storage/${order.delivery.rider.photo}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(order.delivery.rider.name)}&background=6366f1&color=fff&size=80`}
                                                        alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-[3px] border-white rounded-full" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-[10px] font-extrabold text-primary uppercase tracking-wider mb-0.5">
                                                        {order.status === 'out_for_delivery' ? '🚀 Out for Delivery' : '👤 Assigned Rider'}
                                                    </div>
                                                    <div className="text-base font-extrabold text-foreground">{order.delivery.rider.name}</div>
                                                    {order.delivery.rider.phone && (
                                                        <div className="text-sm text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                                                            <Phone className="h-3 w-3" /> {order.delivery.rider.phone}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button size="icon" className="h-12 w-12 rounded-2xl" asChild>
                                                    <a href={`tel:${order.delivery.rider.phone}`}>📱</a>
                                                </Button>
                                            </Card>
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
                                                    onClick={() => handleCancelOrder(order.id)}
                                                    disabled={cancellingId === order.id}
                                                >
                                                    {cancellingId === order.id ? "Cancelling..." : "Cancel Order"}
                                                </Button>
                                            </div>
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
        </div>
    );
}
