import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import ProductDetailModal from "./ProductDetailModal";
import Modal from "../shared/Modal";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, CheckCircle2, Pencil, Trash2, MapPin, Package, AlertTriangle, Navigation, Loader2 } from 'lucide-react';

import "leaflet/dist/leaflet.css";

// Helper component to center map when coordinates change
function CheckoutMapController({ position, onMapClick }) {
    const map = useMap();
    useEffect(() => {
        if (position) map.flyTo(position, map.getZoom());
    }, [position, map]);

    useMapEvents({
        click: onMapClick,
    });
    return null;
}

export default function CustomerOrder() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Review, 2: Invoice & Location
    const [customerProfile, setCustomerProfile] = useState(null);

    const [address, setAddress] = useState("");
    const [payment, setPayment] = useState("cod");

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [checkoutPosition, setCheckoutPosition] = useState([7.0707, 125.608]);
    const [gpsLoading, setGpsLoading] = useState(false);

    // Get current GPS location
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser.", "error");
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCheckoutPosition([position.coords.latitude, position.coords.longitude]);
                setGpsLoading(false);
                showToast("Location updated to your current GPS position.", "success");
            },
            (error) => {
                showToast("Unable to get GPS location.", "error");
                setGpsLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    // Handle manual map click
    const handleMapClick = (e) => {
        setCheckoutPosition([e.latlng.lat, e.latlng.lng]);
    };

    // Update coordinates when marker is dragged
    const handleMarkerDragEnd = (e) => {
        setCheckoutPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]);
    };

    const updateCartItem = (product, options) => {
        const qty = options.qty || 1;
        const variants = options.variants || {};
        const price = options.price || product.sell_price;
        const variant_id = options.variant_id || null;

        const variantLabels = Object.values(variants)
            .filter(Boolean)
            .map((v) => v.label);
        const variantString = variantLabels.join(", ");
        const cartId = variantString
            ? `${product.id}-${variantString}`
            : product.id;

        const newCart = cart.map((item) => {
            if (item.cartId === product.cartId) {
                return {
                    ...item,
                    qty,
                    selectedVariants: variants,
                    sell_price: price,
                    cartId,
                    variantString,
                    variant_id,
                };
            }
            return item;
        });

        setCart(newCart);
        localStorage.setItem("hrms_cart", JSON.stringify(newCart));
    };

    useEffect(() => {
        const saved = localStorage.getItem("hrms_cart");
        if (saved) {
            const cartData = JSON.parse(saved);
            // ONLY show items selected in the cart page
            const selectedOnly = cartData.filter(item => item.selectedForCheckout);
            if (selectedOnly.length === 0) {
                navigate("/shop/cart");
                return;
            }
            setCart(selectedOnly);
        } else {
            navigate("/shop");
        }

        // Fetch customer profile for location
        axios
            .get("/customer/profile")
            .then((res) => {
                setCustomerProfile(res.data.data);
                if (res.data.data?.address) {
                    const profile = res.data.data;
                    setAddress(`${profile.address}, ${profile.municipality}, ${profile.province}`);
                    if (profile.latitude && profile.longitude) {
                        setCheckoutPosition([parseFloat(profile.latitude), parseFloat(profile.longitude)]);
                    }
                }
            })
            .catch(() => console.log("Could not fetch profile"));
    }, [navigate]);

    const removeFromCart = (cartId) => {
        const saved = JSON.parse(localStorage.getItem("hrms_cart") || "[]");
        const newSaved = saved.filter(item => item.cartId !== cartId);
        localStorage.setItem("hrms_cart", JSON.stringify(newSaved));
        
        const newCart = cart.filter(item => item.cartId !== cartId);
        setCart(newCart);
        if (newCart.length === 0) {
            navigate("/shop");
        }
    };

    const total = cart.reduce(
        (sum, item) => sum + item.sell_price * item.qty,
        0,
    );

    const handleCheckout = async (e) => {
        e.preventDefault();

        // Validate address
        if (!address || address.trim().length < 5) {
            showToast("Please enter a valid delivery address (at least 5 characters).", "error");
            return;
        }

        // Validate cart has items
        if (cart.length === 0) {
            showToast("Your cart is empty.", "error");
            return;
        }

        setLoading(true);

        // Debug: Check if user is logged in
        console.log('User:', user);
        console.log('Token:', localStorage.getItem('hrms_token'));
        console.log('Order data:', {
            address: address.trim(),
            payment_method: payment,
            customer_id: user?.id,
            items: cart.map((i) => ({
                product_id: i.id,
                product_variant_id: i.variant_id || null,
                quantity: i.qty,
                price: i.sell_price,
                variants: i.selectedVariants || {},
            })),
        });

        // Test API call first
        try {
            const testResponse = await axios.get('/auth/me');
            console.log('Auth test successful:', testResponse.data);
        } catch (testErr) {
            console.error('Auth test failed:', testErr);
            showToast('Authentication error. Please log in again.', 'error');
            setLoading(false);
            return;
        }

        try {
            console.log('Sending order request...');
            const orderResponse = await axios.post("/sales", {
                address: address.trim(),
                latitude: checkoutPosition[0],
                longitude: checkoutPosition[1],
                payment_method: payment,
                customer_id: user?.id,
                items: cart.map((i) => ({
                    product_id: i.id,
                    product_variant_id: i.variant_id || null,
                    quantity: i.qty,
                    price: i.sell_price,
                    variants: i.selectedVariants || {},
                })),
            });

            console.log('Order placed successfully!', orderResponse.data);
            // Dispatch event to refresh product list on home page
            window.dispatchEvent(new CustomEvent('orderPlaced', { detail: { items: cart } }));
            // Remove placed items from localStorage cart
            const saved = JSON.parse(localStorage.getItem("hrms_cart") || "[]");
            const cartIdsToRemove = cart.map(i => i.cartId);
            const remainingCart = saved.filter(item => !cartIdsToRemove.includes(item.cartId));
            
            if (remainingCart.length > 0) {
                localStorage.setItem("hrms_cart", JSON.stringify(remainingCart));
            } else {
                localStorage.removeItem("hrms_cart");
            }
            setOrderSuccess(true);
        } catch (err) {
            console.error('Order error:', err);
            console.error('Error response:', err.response);
            console.error('Error status:', err.response?.status);
            console.error('Error data:', err.response?.data);
            showToast(
                err.response?.data?.message || "Failed to place order. Please try again.",
                "error",
            );
            setLoading(false);
        }
    };

    if (cart.length === 0) return null;

    // Invoice/Confirmation Step
    if (step === 2) {
        const hasLocation =
            customerProfile?.latitude && customerProfile?.longitude;
        const position = hasLocation
            ? [customerProfile.latitude, customerProfile.longitude]
            : [7.0707, 125.608];

        return (
            <div className="min-h-screen bg-secondary/30 py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    <Card className="p-6 sm:p-8">
                        <h2 className="text-2xl font-bold text-foreground mb-4">📄 Order Invoice & Confirmation</h2>
                        {/* Progress */}
                        <div className="flex items-center justify-center gap-4 mb-8">
                            <div className="flex items-center gap-2 opacity-60">
                                <div className="h-8 w-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">✓</div>
                                <span className="text-sm">Review Items</span>
                            </div>
                            <div className="h-px w-12 bg-border" />
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">2</div>
                                <span className="text-sm font-bold">Confirm & Pay</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* INVOICE CARD */}
                            <Card className="p-6">
                                <div className="flex justify-between items-start mb-6 pb-4 border-b border-border">
                                    <div>
                                        <h3 className="text-2xl font-bold text-foreground mb-1">INVOICE</h3>
                                        <div className="text-sm text-muted-foreground">HRMS Hardware Store</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Date</div>
                                        <div className="font-semibold">{new Date().toLocaleDateString()}</div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <div className="text-sm text-muted-foreground mb-1">Bill To:</div>
                                    <div className="font-semibold">{user?.name}</div>
                                    <div className="text-sm text-muted-foreground">{user?.email}</div>
                                    <div className="text-sm text-muted-foreground">{user?.phone}</div>
                                </div>

                                <div className="mb-4">
                                    <div className="text-sm text-muted-foreground mb-1">Delivery Address:</div>
                                    <div className="text-sm">{address || "No address provided"}</div>
                                </div>

                                <div className="mb-4">
                                    <div className="text-sm text-muted-foreground mb-1">Payment Method:</div>
                                    <Badge variant="secondary" className="text-sm">
                                        {payment === "cod" ? "💵 Cash on Delivery" : payment === "gcash" ? "📱 GCash" : payment === "bank_transfer" ? "🏦 Bank Transfer" : "💳 In-Store Payment"}
                                    </Badge>
                                </div>

                                <div className="border-t border-border pt-4">
                                    <h4 className="font-bold text-foreground mb-3">Order Items</h4>
                                    {cart.map((item) => (
                                        <div key={item.cartId} className="flex gap-3 py-3 border-b border-border/50 items-start">
                                            <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center text-xl shrink-0 overflow-hidden">
                                                {item.image_path ? (
                                                    <img src={`/storage/${item.image_path}`} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                                                ) : <Package className="h-6 w-6 opacity-30 text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-semibold">{item.qty}x</span> {item.name}
                                                {item.variantString && <div className="text-sm text-muted-foreground mt-0.5">[{item.variantString}]</div>}
                                            </div>
                                            <div className="font-semibold text-right whitespace-nowrap">₱{(item.sell_price * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-border pt-4 mt-4 space-y-2">
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT (12%)</span><span>₱{(total * 0.12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping</span><span className="text-green-600 font-semibold">FREE</span></div>
                                    <div className="flex justify-between font-bold text-xl pt-3 mt-2 border-t-2 border-border">
                                        <span>Total Amount</span>
                                        <span className="text-primary">₱{(total * 1.12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </Card>

                            {/* LOCATION CONFIRMATION */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end mb-2">
                                    <h3 className="font-bold text-foreground flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Delivery Location</h3>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleGetLocation} 
                                        disabled={gpsLoading}
                                        className="h-8 text-xs font-semibold gap-1 px-3 bg-white"
                                    >
                                        {gpsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3 text-primary" />}
                                        Use Current GPS
                                    </Button>
                                </div>
                                
                                <p className="text-xs text-muted-foreground italic -mt-2">
                                    The pin below is your default home. If you want this delivered elsewhere today (like work), click "Use Current GPS" or drag the pin.
                                </p>

                                {hasLocation ? (
                                    <>
                                        <div className="h-[240px] rounded-xl overflow-hidden border-2 border-primary/20 cursor-crosshair relative shadow-inner">
                                            <MapContainer center={checkoutPosition} zoom={16} maxZoom={20} style={{ height: "100%", width: "100%" }}>
                                                <CheckoutMapController position={checkoutPosition} onMapClick={handleMapClick} />
                                                <TileLayer 
                                                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" 
                                                    attribution="&copy; Google Maps"
                                                    maxZoom={20}
                                                />
                                                <Marker 
                                                    position={checkoutPosition} 
                                                    draggable={true}
                                                    eventHandlers={{ dragend: handleMarkerDragEnd }}
                                                />
                                            </MapContainer>
                                        </div>

                                        <Card className="bg-amber-50 border-amber-200 p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <MapPin className="h-4 w-4 text-amber-600" />
                                                <span className="font-semibold text-sm text-amber-800">Your Checkout Location</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {checkoutPosition[0].toFixed(6)}, {checkoutPosition[1].toFixed(6)}
                                            </div>
                                        </Card>

                                        <Card className="bg-blue-50 border-blue-200 p-3">
                                            <p className="text-sm text-blue-800 flex items-start gap-2"><MapPin className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" /><span><strong>Delivery Confirmation:</strong><br />Your order will be delivered to the location shown above. Please ensure this is correct before placing your order.</span></p>
                                        </Card>
                                    </>
                                ) : (
                                    <Card className="bg-amber-50 border-amber-200 p-3">
                                        <p className="text-sm text-amber-800 flex items-start gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span><strong>No Location Data:</strong><br />Your account doesn't have GPS coordinates. The rider may need to contact you for directions.</span></p>
                                    </Card>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Confirm or Edit Delivery Address:</Label>
                                    <Textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter complete delivery address" />
                                </div>

                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1 gap-1" onClick={() => setStep(1)} disabled={loading}>
                                        <ArrowLeft className="h-4 w-4" /> Back
                                    </Button>
                                    <Button className="flex-1 gap-1" onClick={handleCheckout} disabled={loading}>
                                        {loading ? "Processing..." : "Place Order"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <ProductDetailModal
                    isOpen={!!selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    product={selectedProduct}
                    onAddToCart={(prod, opts) => updateCartItem(prod, opts)}
                />

                {/* Success Modal */}
                <Modal
                    isOpen={orderSuccess}
                    onClose={() => navigate("/shop/history")}
                    title=""
                    size="sm"
                    hideFooter
                >
                    <div className="py-10 px-4 text-center">
                        <div className="w-24 h-24 bg-green-50 rounded-[35%] flex items-center justify-center mx-auto mb-6 rotate-[10deg] shadow-lg shadow-green-500/15">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-black text-foreground mb-3 tracking-tight">Order Placed!</h2>
                        <p className="text-muted-foreground leading-relaxed mb-8 max-w-[300px] mx-auto">Your order has been successfully processed and our team is now on it.</p>
                        <div className="flex flex-col gap-3">
                            <Button className="w-full h-12 text-base font-bold gap-2" onClick={() => navigate("/shop/history")}>Track Order <ArrowRight className="h-4 w-4" /></Button>
                            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate("/shop")}>Back to Shop</Button>
                        </div>
                    </div>
                </Modal>
            </div>
        );
    }

    // Step 1: Review Items - Simplified to show only Order Summary
    return (
        <div className="min-h-screen bg-secondary/30 py-8 px-4">
            <div className="max-w-xl mx-auto">
                <Card className="p-6 sm:p-8">
                    <h2 className="text-2xl font-bold text-foreground mb-4">Checkout</h2>
                    {/* Progress */}
                    <div className="flex items-center justify-center gap-4 mb-8">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</div>
                            <span className="text-sm font-semibold">Review Items</span>
                        </div>
                        <div className="h-px w-12 bg-border" />
                        <div className="flex items-center gap-2 opacity-50">
                            <div className="h-8 w-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-sm font-bold border border-border">2</div>
                            <span className="text-sm">Confirm & Pay</span>
                        </div>
                    </div>

                    {/* ORDER SUMMARY */}
                    <Card className="p-5 mb-6">
                        <div className="mb-4">
                            <h3 className="text-xl font-extrabold text-foreground">Order Summary</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">Review the items you've selected from your cart.</p>
                        </div>

                        <div className="space-y-0 mb-4">
                            {cart.map((item) => (
                                <div key={item.cartId || item.id} className="flex gap-3 py-3 border-b border-border/50 items-center">
                                    <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                                        {item.image_path ? (
                                            <img src={`/storage/${item.image_path}`} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                                        ) : <Package className="h-7 w-7 opacity-20 text-muted-foreground" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-foreground text-sm truncate">{item.name}</div>
                                        {item.variantString && <div className="text-xs text-muted-foreground">{item.variantString}</div>}
                                        <div className="text-xs text-muted-foreground">Qty: {item.qty} × ₱{item.sell_price.toLocaleString()}</div>
                                        <div className="flex gap-3 mt-1">
                                            {item.product_variants?.length > 0 && (
                                                <button type="button" className="text-[11px] text-primary font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline" onClick={() => setSelectedProduct(item)}>Edit</button>
                                            )}
                                            <button type="button" className="text-[11px] text-destructive font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline" onClick={() => removeFromCart(item.cartId)}>Remove</button>
                                        </div>
                                    </div>
                                    <div className="font-bold text-foreground text-sm whitespace-nowrap">
                                        ₱{(item.sell_price * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t-2 border-border">
                            <span className="text-lg font-bold text-foreground">Total</span>
                            <span className="text-lg font-bold text-primary">₱{(total * 1.12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-right text-xs text-muted-foreground mt-1">Includes VAT (12%)</div>
                    </Card>

                    {/* BUTTONS */}
                    <div className="flex flex-col gap-3">
                        <Button className="w-full h-12 text-base font-bold gap-2" onClick={() => setStep(2)}>
                            Review Invoice & Location <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="w-full h-11 text-base font-semibold gap-2" onClick={() => navigate("/shop")}>
                            <ArrowLeft className="h-4 w-4" /> Back to Shop
                        </Button>
                    </div>

                    <ProductDetailModal
                        isOpen={!!selectedProduct}
                        onClose={() => setSelectedProduct(null)}
                        product={selectedProduct}
                        onAddToCart={(prod, opts) => updateCartItem(prod, opts)}
                    />
                </Card>
            </div>
        </div>
    );
}
