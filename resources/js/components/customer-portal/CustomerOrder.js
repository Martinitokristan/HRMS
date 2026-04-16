
import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { sileo } from 'sileo';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CheckCircle2, Pencil, Trash2, MapPin, Package, AlertTriangle, Navigation, Loader2, Download, Smartphone } from 'lucide-react';
import { QRCodeCanvas } from "qrcode.react";
import { STALE_KEYS, markStale } from "../../store/dataStore";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { usePhilippineAddress } from "../../hooks/usePhilippineAddress";

import "leaflet/dist/leaflet.css";

// EMVCo CRC-16 (CCITT-FALSE) calculation
function crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) > 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function generateDynamicQRPayload(basePayload, amount) {
    if (!basePayload) return "";
    const amountStr = parseFloat(amount).toFixed(2);

    // Tag 54 is Transaction Amount
    const tag = "54";
    const length = amountStr.length.toString().padStart(2, '0');
    const amountPayload = `${tag}${length}${amountStr}`;

    // Convert static flag (010211) -> dynamic flag (010212)
    let payload = basePayload.replace("010211", "010212");

    // Inject before 6304
    const crcIndex = payload.indexOf("6304");
    if (crcIndex !== -1) {
        payload = payload.substring(0, crcIndex) + amountPayload + "6304";
    } else {
        payload += amountPayload + "6304";
    }

    // append new CRC
    const checksum = crc16(payload);
    return payload + checksum;
}

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
    const { user, settings, refreshSettings } = useAuth();
    const { refreshTrigger } = useSilentRefresh('admin_settings');
    const gcashEnabled = !!(settings?.settings?.payments?.gcash_payload || settings?.payments?.gcash_payload);

    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Review, 2: Invoice & Location
    const [customerProfile, setCustomerProfile] = useState(null);

    const [deliveryStreet, setDeliveryStreet] = useState('');
    const [deliveryBarangay, setDeliveryBarangay] = useState('');
    const [deliveryMunicipality, setDeliveryMunicipality] = useState('');
    const [deliveryProvince, setDeliveryProvince] = useState('');
    const [deliveryProvinceCode, setDeliveryProvinceCode] = useState('');
    const [deliveryCityCode, setDeliveryCityCode] = useState('');
    const { provinces: dpProvinces, cities: dpCities, barangays: dpBarangays, loadingProvinces: dpLoadingProvinces, loadingCities: dpLoadingCities, loadingBarangays: dpLoadingBarangays } = usePhilippineAddress('', deliveryProvinceCode, deliveryCityCode);
    const [payment, setPayment] = useState("cod");

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [checkoutPosition, setCheckoutPosition] = useState([7.0707, 125.608]);
    const [gpsLoading, setGpsLoading] = useState(false);

    // GCash State
    const [gcashModal, setGcashModal] = useState(false);
    const [gcashAmount, setGcashAmount] = useState(null);
    const [gcashBasePayload, setGcashBasePayload] = useState("");
    const [paymentPhoneNumber, setPaymentPhoneNumber] = useState("");

    // Initialize payment phone number with user's phone
    useEffect(() => {
        if (user?.phone) {
            setPaymentPhoneNumber(user.phone);
        }
    }, [user]);

    useEffect(() => {
        if (deliveryProvince && dpProvinces.length > 0 && !deliveryProvinceCode) {
            const found = dpProvinces.find(p => p.name === deliveryProvince);
            if (found) setDeliveryProvinceCode(found.code);
        }
    }, [deliveryProvince, dpProvinces]);

    useEffect(() => {
        if (deliveryMunicipality && dpCities.length > 0 && !deliveryCityCode) {
            const found = dpCities.find(c => c.name === deliveryMunicipality);
            if (found) setDeliveryCityCode(found.code);
        }
    }, [deliveryMunicipality, dpCities]);

    // Refresh settings on mount and when refreshTrigger changes
    useEffect(() => {
        refreshSettings();
    }, [refreshTrigger, refreshSettings]);

    // Get current GPS location
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            sileo.error("Geolocation is not supported by your browser.");
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCheckoutPosition([position.coords.latitude, position.coords.longitude]);
                setGpsLoading(false);
                sileo.success("Location updated to your current GPS position.");
            },
            (error) => {
                sileo.error("Unable to get GPS location.");
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

        const newCart = Array.isArray(cart) ? cart.map((item) => {
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
        }) : [];

        setCart(newCart);
        localStorage.setItem("hrms_cart", JSON.stringify(newCart));
    };

    useEffect(() => {
        const saved = localStorage.getItem("hrms_cart");
        if (saved) {
            try {
                const cartData = JSON.parse(saved);
                // ONLY show items selected in the cart page
                const selectedOnly = Array.isArray(cartData) ? cartData.filter(item => item.selectedForCheckout) : [];
                if (selectedOnly.length === 0) {
                    navigate("/shop/cart");
                    return;
                }
                setCart(selectedOnly);
            } catch (e) {
                console.error("Cart parse error:", e);
                navigate("/shop");
            }
        } else {
            navigate("/shop");
        }

        // Fetch customer profile for location
        api
            .get("/customer/profile")
            .then((res) => {
                const profile = res.data;
                setCustomerProfile(profile);
                if (profile?.address) {
                    setDeliveryStreet(profile.address || '');
                    setDeliveryBarangay(profile.barangay || '');
                    setDeliveryMunicipality(profile.municipality || '');
                    setDeliveryProvince(profile.province || '');
                    if (profile.latitude && profile.longitude) {
                        setCheckoutPosition([parseFloat(profile.latitude), parseFloat(profile.longitude)]);
                    }
                }
            })
            .catch(() => console.log("Could not fetch profile"));
    }, [navigate]);

    const removeFromCart = (cartId) => {
        try {
            const saved = JSON.parse(localStorage.getItem("hrms_cart") || "[]");
            const newSaved = Array.isArray(saved) ? saved.filter(item => item.cartId !== cartId) : [];
            localStorage.setItem("hrms_cart", JSON.stringify(newSaved));

            const newCart = Array.isArray(cart) ? cart.filter(item => item.cartId !== cartId) : [];
            setCart(newCart);
            if (newCart.length === 0) {
                navigate("/shop");
            }
        } catch (e) {
            console.error("Remove from cart error:", e);
        }
    };

    const total = Array.isArray(cart) ? cart.reduce(
        (sum, item) => sum + item.sell_price * item.qty,
        0,
    ) : 0;

    const handleCheckout = async (e) => {
        e.preventDefault();

        // Validate address
        if (!deliveryStreet || !deliveryMunicipality || !deliveryProvince) {
            sileo.error("Please complete your delivery address (province, municipality, and street are required).");
            return;
        }
        const address = [deliveryStreet.trim(), deliveryBarangay, deliveryMunicipality, deliveryProvince].filter(Boolean).join(', ');

        // Validate cart has items
        if (!cart || cart.length === 0) {
            sileo.error("Your cart is empty.");
            return;
        }

        setLoading(true);

        try {
            const orderResponse = await api.post("/sales", {
                address: address.trim(),
                latitude: checkoutPosition[0],
                longitude: checkoutPosition[1],
                payment_method: payment,
                payment_phone_number: payment === 'gcash' ? paymentPhoneNumber : null,
                customer_id: user?.id,
                items: cart.map((i) => ({
                    product_id: i.id,
                    product_variant_id: i.variant_id || null,
                    quantity: i.qty,
                    price: i.sell_price,
                    variants: i.selectedVariants || {},
                })),
            });

            if (payment === "gcash") {
                const totalAmt = orderResponse.data.data?.total_amount || orderResponse.data.total_amount;
                setGcashAmount(totalAmt);
                setGcashBasePayload(orderResponse.data.gcash_payload);
                setGcashModal(true);
                return; 
            }

            // Normal COD completion
            completeOrderSuccess();

        } catch (err) {
            console.error('Order error:', err);
            sileo.error(err.response?.data?.message || "Failed to place order. Please try again.");
            setLoading(false);
        }
    };

    const completeOrderSuccess = () => {
        // Broadly synchronize state across all relevant roles
        markStale(
            STALE_KEYS.CUSTOMER_ORDERS,
            STALE_KEYS.CUSTOMER_CART,
            STALE_KEYS.ADMIN_ORDERS,
            STALE_KEYS.ADMIN_DASHBOARD,
            STALE_KEYS.CUSTOMER_SHOP
        );

        // Remove placed items from localStorage cart
        try {
            const saved = JSON.parse(localStorage.getItem("hrms_cart") || "[]");
            const cartIdsToRemove = cart.map(i => i.cartId);
            const remainingCart = Array.isArray(saved) ? saved.filter(item => !cartIdsToRemove.includes(item.cartId)) : [];

            if (remainingCart.length > 0) {
                localStorage.setItem("hrms_cart", JSON.stringify(remainingCart));
            } else {
                localStorage.removeItem("hrms_cart");
            }
        } catch (e) {
            localStorage.removeItem("hrms_cart");
        }
        setOrderSuccess(true);
        setGcashModal(false);
    };

    if (!cart || cart.length === 0) return null;

    // Invoice/Confirmation Step
    if (step === 2) {
        const hasLocation =
            customerProfile?.latitude && customerProfile?.longitude;

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
                                    <div className="text-sm">{[deliveryStreet, deliveryBarangay, deliveryMunicipality, deliveryProvince].filter(Boolean).join(', ') || "No address provided"}</div>
                                </div>

                                <div className="mb-4">
                                    <div className="text-sm text-muted-foreground mb-1">Payment Method:</div>
                                    <Badge variant="secondary" className="text-sm">
                                        {payment === "cod" ? "💵 Cash on Delivery" : payment === "gcash" ? "📱 GCash" : payment === "bank_transfer" ? "🏦 Bank Transfer" : "💳 In-Store Payment"}
                                    </Badge>
                                </div>

                                <div className="border-t border-border pt-4">
                                    <h4 className="font-bold text-foreground mb-3">Order Items</h4>
                                    {Array.isArray(cart) && cart.map((item) => (
                                        <div key={item.cartId} className="flex gap-3 py-3 border-b border-border/50 items-start">
                                            <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center text-xl shrink-0 overflow-hidden">
                                                {item.image_path ? (
                                                    <img src={`/storage/${item.image_path}`} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                                                ) : <Package className="h-6 w-6 opacity-30 text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-semibold">{item.qty}x</span> {item.name}
                                                {item.brand?.name && <div className="text-xs font-semibold text-orange-500 mt-0.5">{item.brand.name}</div>}
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

                                {!hasLocation && (
                                    <Card className="bg-amber-50 border-amber-200 p-3">
                                        <p className="text-sm text-amber-800 flex items-start gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span><strong>No saved location:</strong> Pin is set to a default position. Use "Use Current GPS" or drag the pin to set your delivery location.</span></p>
                                    </Card>
                                )}

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

                                {/* PAYMENT METHOD */}
                                <div className="space-y-3 mb-6">
                                    <Label className="text-sm font-semibold">Payment Method:</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div
                                            className={`border rounded-lg p-3 cursor-pointer transition-all ${payment === "cod" ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-1" : "border-border hover:bg-secondary/50"}`}
                                            onClick={() => setPayment("cod")}
                                        >
                                            <div className="flex items-center gap-2 font-semibold">
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${payment === "cod" ? "border-primary" : "border-muted-foreground"}`}>
                                                    {payment === "cod" && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                </div>
                                                💵 Cash on Delivery
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1 ml-6">Pay when your order arrives</div>
                                        </div>

                                        {gcashEnabled ? (
                                        <div
                                            className={`border rounded-lg p-3 cursor-pointer transition-all ${payment === "gcash" ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500 ring-offset-1" : "border-border hover:bg-secondary/50"}`}
                                            onClick={() => setPayment("gcash")}
                                        >
                                            <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${payment === "gcash" ? "border-blue-500" : "border-muted-foreground"}`}>
                                                    {payment === "gcash" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                                </div>
                                                📱 GCash
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1 ml-6">Pay via QR code with reference verification</div>
                                        </div>
                                        ) : (
                                        <div className="border rounded-lg p-3 opacity-40 cursor-not-allowed border-border bg-secondary/30">
                                            <div className="flex items-center gap-2 font-semibold text-muted-foreground">
                                                📱 GCash
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">GCash not available at the moment</div>
                                        </div>
                                        )}
                                    </div>

                                    {payment === "gcash" && (
                                        <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                                            <Label className="text-sm font-semibold text-blue-900 mb-1.5 block flex items-center gap-2">
                                                <Smartphone className="h-4 w-4" /> GCash Number Used to Pay
                                            </Label>
                                            <p className="text-xs text-blue-700/80 mb-3 italic">
                                                Please confirm the exact GCash number you will use to send the payment. This is required to verify your transaction automatically.
                                            </p>
                                            <Input
                                                value={paymentPhoneNumber}
                                                onChange={(e) => setPaymentPhoneNumber(e.target.value)}
                                                placeholder="e.g. 09123456789"
                                                className="bg-white border-blue-200 focus-visible:ring-blue-500 text-base py-5"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">Confirm or Edit Delivery Address:</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-muted-foreground">Province *</Label>
                                            <Select
                                                value={deliveryProvinceCode}
                                                onValueChange={code => {
                                                    const found = dpProvinces.find(p => p.code === code);
                                                    setDeliveryProvinceCode(code);
                                                    setDeliveryProvince(found ? found.name : '');
                                                    setDeliveryCityCode('');
                                                    setDeliveryMunicipality('');
                                                    setDeliveryBarangay('');
                                                }}
                                                disabled={dpLoadingProvinces}
                                            >
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder={dpLoadingProvinces ? 'Loading…' : 'Select Province'} />
                                                </SelectTrigger>
                                                <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                                                    {dpProvinces.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-muted-foreground">Municipality / City *</Label>
                                            <Select
                                                value={deliveryCityCode}
                                                onValueChange={code => {
                                                    const found = dpCities.find(c => c.code === code);
                                                    setDeliveryCityCode(code);
                                                    setDeliveryMunicipality(found ? found.name : '');
                                                    setDeliveryBarangay('');
                                                }}
                                                disabled={!deliveryProvinceCode || dpLoadingCities}
                                            >
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder={!deliveryProvinceCode ? 'Select Province first' : dpLoadingCities ? 'Loading…' : 'Select Municipality / City'} />
                                                </SelectTrigger>
                                                <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                                                    {dpCities.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5 sm:col-span-2">
                                            <Label className="text-xs font-medium text-muted-foreground">Barangay</Label>
                                            <Select
                                                value={deliveryBarangay}
                                                onValueChange={setDeliveryBarangay}
                                                disabled={!deliveryCityCode || dpLoadingBarangays}
                                            >
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder={!deliveryCityCode ? 'Select Municipality first' : dpLoadingBarangays ? 'Loading…' : 'Select Barangay'} />
                                                </SelectTrigger>
                                                <SelectContent position="popper" side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-64 overflow-y-auto">
                                                    {dpBarangays.map(b => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">House No. / Street / Purok *</Label>
                                        <Input value={deliveryStreet} onChange={e => setDeliveryStreet(e.target.value)} placeholder="e.g. 123 Rizal St., Purok 4" required />
                                    </div>
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

                {/* GCash Payment Modal */}
                {gcashModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
                        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.16)', width: '90vw', maxWidth: 420, fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>

                            {/* Blue header */}
                            <div style={{ background: '#1A6FE8', padding: '12px 20px', textAlign: 'center' }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                                    ₱{parseFloat(gcashAmount || 0).toFixed(2)}
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                                    Pay this exact amount via GCash
                                </div>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '16px 20px 0' }}>

                                {/* QR code */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#F4F6F9', borderRadius: 10, padding: '14px 14px 10px' }}>
                                    {gcashAmount && gcashBasePayload && (
                                        <QRCodeCanvas
                                            id="dynamic-gcash-qr"
                                            value={generateDynamicQRPayload(gcashBasePayload, gcashAmount)}
                                            size={180}
                                            level="M"
                                            includeMargin={true}
                                        />
                                    )}
                                    {/* Save QR button */}
                                    <button
                                        style={{ marginTop: 8, height: 32, padding: '0 14px', fontSize: 13, color: '#1A6FE8', background: '#fff', border: '1px solid #1A6FE8', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                        onClick={() => {
                                            const canvas = document.getElementById('dynamic-gcash-qr');
                                            if (canvas) {
                                                const url = canvas.toDataURL('image/png');
                                                const link = document.createElement('a');
                                                link.download = `GCash-Payment-${parseFloat(gcashAmount).toFixed(2)}.png`;
                                                link.href = url;
                                                link.click();
                                                sileo.success("QR code saved to your device!");
                                            }
                                        }}
                                    >
                                        <Download className="h-3.5 w-3.5" /> Save QR Image
                                    </button>
                                    {/* Open GCash app — mobile only */}
                                    <button
                                        className="sm:hidden"
                                        style={{ marginTop: 6, height: 32, padding: '0 14px', fontSize: 13, color: '#fff', background: '#1A6FE8', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                        onClick={() => {
                                            window.location.href = "intent://#Intent;scheme=gcash;package=com.globe.gcash.android;end";
                                            setTimeout(() => {
                                                window.open("https://play.google.com/store/apps/details?id=com.globe.gcash.android", "_blank");
                                            }, 1000);
                                        }}
                                    >
                                        <Smartphone className="h-3.5 w-3.5" /> Open GCash App
                                    </button>
                                </div>

                                {/* Instructions */}
                                <div style={{ background: '#F4F6F9', borderRadius: 8, padding: '10px 12px', marginTop: 10 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>How to pay on mobile:</div>
                                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#6B7280', lineHeight: 1.6, listStyleType: 'decimal' }}>
                                        <li>Tap <strong style={{ color: '#1A1A2E' }}>Save QR Image</strong> above.</li>
                                        <li>Open GCash → tap <strong style={{ color: '#1A1A2E' }}>Scan</strong> or <strong style={{ color: '#1A1A2E' }}>Pay QR</strong>.</li>
                                        <li>Select <strong style={{ color: '#1A1A2E' }}>Upload image</strong> and choose the saved QR.</li>
                                        <li>Confirm number: <strong style={{ color: '#1A6FE8' }}>{paymentPhoneNumber}</strong></li>
                                    </ol>
                                </div>

                                {/* CTA */}
                                <div style={{ padding: '12px 0 16px' }}>
                                    <button
                                        style={{ width: '100%', height: 44, background: '#FF6B00', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                        onClick={completeOrderSuccess}
                                    >
                                        <CheckCircle2 className="h-4 w-4" /> Done, I have Paid!
                                    </button>
                                    <button
                                        style={{ width: '100%', marginTop: 8, height: 36, background: 'none', border: 'none', fontSize: 13, color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                        onClick={() => { setGcashModal(false); navigate("/shop"); }}
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Shop
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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
                            {Array.isArray(cart) && cart.map((item) => (
                                <div key={item.cartId || item.id} className="flex gap-3 py-3 border-b border-border/50 items-center">
                                    <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                                        {item.image_path ? (
                                            <img src={`/storage/${item.image_path}`} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                                        ) : <Package className="h-7 w-7 opacity-20 text-muted-foreground" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-foreground text-sm truncate">{item.name}</div>
                                        {item.brand?.name && <div className="text-xs font-semibold text-orange-500">{item.brand.name}</div>}
                                        {item.variantString && <div className="text-xs text-muted-foreground">{item.variantString}</div>}
                                        <div className="text-xs text-muted-foreground">Qty: {item.qty} × ₱{(item.sell_price || 0).toLocaleString()}</div>
                                        <div className="flex gap-3 mt-1">
                                            {item.product_variants?.length > 0 && (
                                                <button type="button" className="text-[11px] text-primary font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline" onClick={() => setSelectedProduct(item)}>Edit</button>
                                            )}
                                            <button type="button" className="text-[11px] text-destructive font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline" onClick={() => removeFromCart(item.cartId)}>Remove</button>
                                        </div>
                                    </div>
                                    <div className="font-bold text-foreground text-sm whitespace-nowrap">
                                        ₱{((item.sell_price || 0) * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
