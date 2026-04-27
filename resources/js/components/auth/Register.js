import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import api from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Mail,
    RefreshCw,
    Loader2,
    CheckCircle,
    AlertCircle,
    UserPlus,
    MapPin,
    Shield,
    Navigation,
    Eye,
    EyeOff,
    ArrowLeft,
} from "lucide-react";
import { PhAddressFields } from "../shared/PhAddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useFormValidation } from "../../hooks/useFormValidation";
import {
    MapContainer,
    TileLayer,
    Marker,
    useMap,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Helper component to center map when coordinates change
function MapController({ center, zoom, onMapClick }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, zoom);
    }, [center, zoom, map]);

    useMapEvents({
        click: onMapClick,
    });
    return null;
}

// Keeps the field strictly in the "09XXXXXXXXX" shape. Accepts pastes like
// "+63 917 123 4567" or "639171234567" and converts them to "09171234567".
const normalizePhone = (raw) => {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("63")) digits = digits.slice(2);
    if (digits.length > 0 && !digits.startsWith("0")) digits = "0" + digits;
    return digits.substring(0, 11);
};

export default function Register() {
    const { showToast } = useToast();
    const { register } = useAuth();
    const navigate = useNavigate();
    const {
        errors,
        validateName,
        validatePhone,
        validatePassword,
        setError,
        clearError,
        clearAllErrors,
    } = useFormValidation();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        password_confirmation: "",
        age: "",
        sex: "",
        province: "",
        municipality: "",
        barangay: "",
        zip_code: "",
        address: "",
        landmark: "",
        latitude: "",
        longitude: "",
    });

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [successMsg, setSuccessMsg] = useState("");
    const [capsWarning, setCapsWarning] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [pinnedAddressDetails, setPinnedAddressDetails] = useState("");
    const [mapCenter, setMapCenter] = useState([8.9475, 125.5406]); // Default Butuan City

    // Function to search coordinates based on address
    const handleGeocode = async () => {
        const query = formData.address
            ? `${formData.address}, ${formData.municipality}, ${formData.province}, Philippines`
            : `${formData.municipality}, ${formData.province}, Philippines`;

        if (formData.municipality.length < 3) {
            alert("Please enter a Municipality/City first.");
            return;
        }

        setIsGeocoding(true);
        try {
            // Internal logic: Try full address, then fallback to city
            let response = await axios.get(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
            );

            if (!response.data || response.data.length === 0) {
                const fallbackQuery = `${formData.municipality}, ${formData.province}, Philippines`;
                response = await axios.get(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}`,
                );
            }

            if (response.data && response.data.length > 0) {
                const { lat, lon } = response.data[0];
                const newCoords = {
                    lat: parseFloat(lat),
                    lon: parseFloat(lon),
                };
                setFormData((prev) => ({
                    ...prev,
                    latitude: newCoords.lat,
                    longitude: newCoords.lon,
                }));
                setMapCenter([newCoords.lat, newCoords.lon]);
                setPinnedAddressDetails(response.data[0].display_name);
            } else {
                alert(
                    "Location not found. Please click on the map manually to pin your location.",
                );
                // Center on a rough Filipino coordinate if totally lost
                setMapCenter([8.9475, 125.5406]);
            }
        } catch (error) {
            console.error("Geocoding failed:", error);
        } finally {
            setIsGeocoding(false);
        }
    };

    // Reverse Geocode to get address for a given lat/lon
    const reverseGeocode = async (lat, lon) => {
        try {
            const res = await axios.get(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            );
            if (res.data) {
                if (
                    res.data.address &&
                    res.data.address.postcode &&
                    !formData.zip_code
                ) {
                    setFormData((prev) => ({
                        ...prev,
                        zip_code: res.data.address.postcode,
                    }));
                }
            }
        } catch (error) {
            console.error("Silent Reverse Geocode failure");
        }
    };

    // Handle manual map click
    const handleMapClick = (e) => {
        const { lat, lng } = e.latlng;
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        reverseGeocode(lat, lng);
    };

    // Update coordinates when marker is dragged
    const onMarkerDragEnd = (e) => {
        const { lat, lng } = e.target.getLatLng();
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        reverseGeocode(lat, lng);
    };

    // Get current GPS location
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setFormData((prev) => ({ ...prev, latitude, longitude }));
                setMapCenter([latitude, longitude]);
                reverseGeocode(latitude, longitude);
                setGpsLoading(false);
            },
            (error) => {
                alert(
                    "Unable to retrieve your location. Please check your browser permissions.",
                );
                setGpsLoading(false);
            },
            { enableHighAccuracy: true },
        );
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        let newValue = value;
        if (name === "phone") {
            newValue = normalizePhone(value);
        }

        setFormData({ ...formData, [name]: newValue });

        // Real-time validation
        let error = null;
        if (name === "name") error = validateName(newValue);
        if (name === "phone") error = validatePhone(newValue);
        if (name === "password") error = validatePassword(newValue);

        if (error) {
            setError(name, error);
        } else {
            clearError(name);
        }

        if (name === "password_confirmation") {
            if (newValue !== formData.password)
                setError("password_confirmation", "Passwords do not match");
            else clearError("password_confirmation");
        }
        if (name === "password" && formData.password_confirmation) {
            if (newValue !== formData.password_confirmation)
                setError("password_confirmation", "Passwords do not match");
            else clearError("password_confirmation");
        }
    };

    const handleKeyDown = (e) => {
        if (e.getModifierState("CapsLock")) {
            setCapsWarning(true);
        } else {
            setCapsWarning(false);
        }
    };
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMsg, setResendMsg] = useState("");
    const [resendError, setResendError] = useState("");

    const handleResend = async () => {
        setResendLoading(true);
        setResendMsg("");
        setResendError("");
        try {
            const response = await api.post("/auth/resend-verification", {
                email: formData.email,
            });
            setResendMsg(response.data.message);
        } catch (err) {
            setResendError(
                err.response?.data?.message || "Failed to resend email.",
            );
        } finally {
            setResendLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("form", "");
        clearAllErrors();
        setSuccessMsg("");

        const nameErr = validateName(formData.name);
        const phoneErr = validatePhone(formData.phone);
        const passErr = validatePassword(formData.password);

        if (nameErr) setError("name", nameErr);
        if (phoneErr) setError("phone", phoneErr);
        if (passErr) setError("password", passErr);

        if (formData.password !== formData.password_confirmation) {
            setError("password_confirmation", "Passwords do not match");
        }

        if (
            nameErr ||
            phoneErr ||
            passErr ||
            formData.password !== formData.password_confirmation
        ) {
            return;
        }

        setLoading(true);

        try {
            const dataToSubmit = {
                ...formData,
                role: "customer",
                phone: formData.phone,
            };
            await register(dataToSubmit);
            setSuccessMsg(
                "Account created successfully! Please check your email to verify your account.",
            );
        } catch (err) {
            const serverErrors = err.response?.data?.errors || {};
            const firstKey = Object.keys(serverErrors)[0];
            const firstMsg = firstKey ? serverErrors[firstKey][0] : null;
            const summary =
                firstMsg ||
                err.response?.data?.message ||
                "Registration failed.";
            setError("form", summary);
            showToast(summary, "error");
            if (err.response?.data?.errors) {
                Object.keys(serverErrors).forEach((key) => {
                    setError(key, serverErrors[key][0]);
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-card">
            {/* Success Modal */}
            {!!successMsg && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: 12,
                            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                            width: "90vw",
                            maxWidth: 400,
                            padding: "32px 28px 24px",
                            position: "relative",
                            borderTop: "3px solid #F97316",
                            textAlign: "center",
                            fontFamily: "Inter, system-ui, sans-serif",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            style={{
                                position: "absolute",
                                top: 12,
                                right: 14,
                                fontSize: 18,
                                color: "#9CA3AF",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                lineHeight: 1,
                            }}
                        >
                            ×
                        </button>
                        <div
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: "50%",
                                background: "#FFF4ED",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 16px",
                            }}
                        >
                            <Mail
                                style={{
                                    width: 22,
                                    height: 22,
                                    color: "#F97316",
                                }}
                            />
                        </div>
                        <div
                            style={{
                                fontSize: 18,
                                fontWeight: 700,
                                color: "#111827",
                                marginBottom: 10,
                            }}
                        >
                            Verify Your Email
                        </div>
                        <div
                            style={{
                                fontSize: 13,
                                color: "#6B7280",
                                lineHeight: 1.6,
                                marginBottom: 20,
                            }}
                        >
                            We've sent a verification link to{" "}
                            <strong
                                style={{ color: "#111827", fontWeight: 600 }}
                            >
                                {formData.email}
                            </strong>
                            <br />
                            Check your inbox and click the link to activate your
                            account.
                        </div>
                        {resendMsg && (
                            <Alert className="bg-green-50 text-green-800 border-green-200 mb-3 text-left">
                                <AlertDescription>{resendMsg}</AlertDescription>
                            </Alert>
                        )}
                        {resendError && (
                            <Alert
                                variant="destructive"
                                className="mb-3 text-left"
                            >
                                <AlertDescription>
                                    {resendError}
                                </AlertDescription>
                            </Alert>
                        )}
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resendLoading}
                            style={{
                                width: "100%",
                                height: 42,
                                background: "#F97316",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: resendLoading
                                    ? "not-allowed"
                                    : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 7,
                                opacity: resendLoading ? 0.75 : 1,
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => {
                                if (!resendLoading)
                                    e.currentTarget.style.background =
                                        "#EA6C0A";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#F97316";
                            }}
                        >
                            {resendLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <RefreshCw style={{ width: 14, height: 14 }} />
                            )}
                            Resend Verification Link
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            style={{
                                marginTop: 10,
                                width: "100%",
                                background: "none",
                                border: "none",
                                fontSize: 13,
                                color: "#6B7280",
                                cursor: "pointer",
                                padding: "6px 0",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#111827";
                                e.currentTarget.style.textDecoration =
                                    "underline";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = "#6B7280";
                                e.currentTarget.style.textDecoration = "none";
                            }}
                        >
                            Return to Login
                        </button>
                    </div>
                </div>
            )}

            <div className="relative flex items-center justify-center px-6 py-10 overflow-y-auto">
                <div className="w-full max-w-[580px]">
                    <button
                        type="button"
                        onClick={() =>
                            window.history.length > 1
                                ? navigate(-1)
                                : navigate("/")
                        }
                        className="fixed top-6 left-6 z-50 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur hover:bg-white hover:text-gray-900"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <div
                        className="flex items-center gap-2.5 cursor-pointer mb-8"
                        onClick={() => navigate("/")}
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F97316] shadow-lg shadow-orange-200">
                            <span className="text-sm font-black text-white">
                                H
                            </span>
                        </div>
                        <div>
                            <span className="text-xl font-black text-gray-900">
                                HRMS
                            </span>
                            <span className="block text-[10px] text-gray-400 font-medium -mt-0.5 tracking-widest uppercase">
                                Hardware Store
                            </span>
                        </div>
                    </div>

                    <h1 className="text-[28px] font-black text-gray-900 tracking-tight mb-1">
                        Customer Registration
                    </h1>
                    <p className="text-base text-gray-500 mb-8">
                        Create your customer account to place orders and track
                        deliveries.
                    </p>

                    {errors.form && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errors.form}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Account Security */}
                        <Card className="bg-secondary/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-base font-bold">
                                    <Shield className="h-5 w-5 text-primary" />
                                    Account Security
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="name"
                                        className="text-base font-medium"
                                    >
                                        Username / Display Name
                                    </Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        type="text"
                                        value={formData.name}
                                        required
                                        onChange={handleChange}
                                        placeholder="First & Last Name"
                                        className={`h-12 text-base ${errors.name ? "border-red-500" : ""}`}
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-red-500 mt-1">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="reg-email"
                                            className="text-base font-medium"
                                        >
                                            Email Address
                                        </Label>
                                        <Input
                                            id="reg-email"
                                            name="email"
                                            type="email"
                                            value={formData.email}
                                            required
                                            onChange={handleChange}
                                            placeholder=""
                                            className={`h-12 text-base ${errors.email ? "border-red-500" : ""}`}
                                        />
                                        {errors.email && (
                                            <p className="text-sm text-red-500 mt-1">
                                                {errors.email}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="phone"
                                            className="text-base font-medium"
                                        >
                                            Phone Number
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="phone"
                                                name="phone"
                                                type="tel"
                                                value={formData.phone}
                                                required
                                                onChange={handleChange}
                                                placeholder="09XXXXXXXXX"
                                                maxLength={11}
                                                inputMode="numeric"
                                                pattern="09[0-9]{9}"
                                                autoComplete="tel"
                                                className={`h-12 text-base ${errors.phone ? "border-red-500" : ""}`}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Must be 11 digits starting with 09
                                            (e.g. 09171234567).
                                        </p>
                                        {errors.phone && (
                                            <p className="text-sm text-red-500 mt-1">
                                                {errors.phone}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="reg-password"
                                            className="text-base font-medium"
                                        >
                                            Password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="reg-password"
                                                name="password"
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                required
                                                value={formData.password}
                                                onChange={handleChange}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Min 8 chars, 1 letter, 1 number"
                                                className={`h-12 text-base pr-11 ${errors.password ? "border-red-500" : ""}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowPassword((v) => !v)
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                        {capsWarning && (
                                            <p className="text-sm text-orange-500 my-1 font-semibold">
                                                ⚠ Caps Lock is on!
                                            </p>
                                        )}
                                        {errors.password && (
                                            <p className="text-sm text-red-500 mt-1">
                                                {errors.password}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="reg-confirm"
                                            className="text-base font-medium"
                                        >
                                            Confirm Password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="reg-confirm"
                                                name="password_confirmation"
                                                type={
                                                    showConfirm
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={
                                                    formData.password_confirmation
                                                }
                                                required
                                                onChange={handleChange}
                                                placeholder="Repeat password"
                                                className={`h-12 text-base pr-11 ${errors.password_confirmation ? "border-red-500" : ""}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowConfirm((v) => !v)
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showConfirm ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                        {errors.password_confirmation && (
                                            <p className="text-sm text-red-500 mt-1">
                                                {errors.password_confirmation}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Shipment Details */}
                        <Card className="bg-secondary/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-base font-bold">
                                    <MapPin className="h-5 w-5 text-primary" />
                                    Shipment Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <PhAddressFields
                                        province={formData.province}
                                        municipality={formData.municipality}
                                        barangay={formData.barangay}
                                        address={formData.address}
                                        onProvinceChange={(name) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                province: name,
                                                municipality: "",
                                                barangay: "",
                                            }))
                                        }
                                        onMunicipalityChange={(name) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                municipality: name,
                                                barangay: "",
                                            }))
                                        }
                                        onBarangayChange={(name) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                barangay: name,
                                            }))
                                        }
                                        onAddressChange={(name) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                address: name,
                                            }))
                                        }
                                        errors={{
                                            province: errors.province,
                                            municipality: errors.municipality,
                                            barangay: errors.barangay,
                                            address: errors.address,
                                        }}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="zip_code"
                                            className="text-base font-medium"
                                        >
                                            Zip / Postal Code
                                        </Label>
                                        <Input
                                            id="zip_code"
                                            name="zip_code"
                                            type="text"
                                            required
                                            onChange={handleChange}
                                            placeholder="e.g. 8600"
                                            className={`h-12 text-base ${errors.zip_code ? "border-red-500" : ""}`}
                                        />
                                        {errors.zip_code && (
                                            <p className="text-sm text-red-500 mt-1">
                                                {errors.zip_code}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="landmark"
                                            className="text-base font-medium"
                                        >
                                            Landmark / Delivery Instructions
                                        </Label>
                                        <Input
                                            id="landmark"
                                            name="landmark"
                                            type="text"
                                            onChange={handleChange}
                                            placeholder="Optional: e.g. Near Blue Gate"
                                            className={`h-12 text-base ${errors.landmark ? "border-red-500" : ""}`}
                                        />
                                        {errors.landmark && (
                                            <p className="text-sm text-red-500 mt-1">
                                                {errors.landmark}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <Label className="text-base font-bold text-primary flex items-center gap-2">
                                            <MapPin className="h-5 w-5" />
                                            Pin Delivery Location
                                        </Label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleGetLocation}
                                                disabled={
                                                    gpsLoading ||
                                                    !formData.province ||
                                                    !formData.municipality ||
                                                    !formData.address
                                                }
                                                className="text-xs h-8 px-3 font-semibold text-primary"
                                                title="Type your address first to use GPS Auto-Locate"
                                            >
                                                {gpsLoading ? (
                                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                ) : (
                                                    <Navigation className="h-3 w-3 mr-1" />
                                                )}
                                                Use Current GPS
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic leading-snug">
                                        Manual: Click on the map or drag the pin
                                        to your exact delivery spot. <br />
                                        <span className="font-bold text-amber-600 block mt-1">
                                            ⚠️ Note: Desktop/Laptop GPS can be
                                            slightly off. Please zoom in deeply
                                            and drag the pin EXACTLY to your
                                            house roof.
                                        </span>
                                    </p>
                                    <div className="h-[260px] w-full rounded-xl border-2 border-primary/20 overflow-hidden relative shadow-inner cursor-crosshair">
                                        <MapContainer
                                            center={mapCenter}
                                            zoom={15}
                                            maxZoom={20}
                                            style={{
                                                height: "100%",
                                                width: "100%",
                                            }}
                                        >
                                            <MapController
                                                center={mapCenter}
                                                zoom={15}
                                                onMapClick={handleMapClick}
                                            />
                                            <TileLayer
                                                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                                                attribution="&copy; Google Maps"
                                                maxZoom={20}
                                            />
                                            <Marker
                                                position={
                                                    formData.latitude &&
                                                    formData.longitude
                                                        ? [
                                                              formData.latitude,
                                                              formData.longitude,
                                                          ]
                                                        : mapCenter
                                                }
                                                draggable={true}
                                                eventHandlers={{
                                                    dragend: onMarkerDragEnd,
                                                }}
                                            />
                                        </MapContainer>
                                        {!formData.latitude &&
                                            !formData.address && (
                                                <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-[1000] flex items-center justify-center p-4 text-center">
                                                    <div className="bg-white p-4 rounded-xl shadow-lg border border-primary/10">
                                                        <MapPin className="h-8 w-8 text-primary mx-auto mb-2 opacity-50" />
                                                        <p className="text-sm font-bold text-foreground">
                                                            Set Address First
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            Then use 'Use
                                                            Current GPS' or
                                                            click the map
                                                            manually.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                    </div>

                                    {(formData.latitude ||
                                        formData.longitude) && (
                                        <div className="text-xs p-2.5 bg-green-50/50 text-green-800 border-l-4 border-green-500 rounded-lg mt-2 flex items-start gap-2 shadow-sm">
                                            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                                            <div>
                                                <span className="font-bold block text-green-900 mb-0.5">
                                                    Location Pinned For:
                                                </span>
                                                <span className="text-green-700/90 leading-relaxed font-semibold">
                                                    {formData.address
                                                        ? `${formData.address}, ${formData.municipality}, ${formData.province}`
                                                        : "Exact GPS Coordinates Captured"}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="text-center space-y-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full max-w-[340px] mx-auto h-12 text-[15px] font-bold bg-[#F97316] hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />{" "}
                                        Creating account...
                                    </>
                                ) : (
                                    "Create Customer Account"
                                )}
                            </Button>

                            <p className="text-base text-muted-foreground">
                                Already registered?{" "}
                                <Link
                                    to="/login"
                                    className="font-bold text-primary hover:underline"
                                >
                                    Sign In
                                </Link>
                            </p>
                            <Separator />
                            <Link
                                to="/rider/register"
                                className="text-base font-bold text-primary hover:underline inline-block"
                            >
                                Apply as Delivery Rider &rarr;
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
