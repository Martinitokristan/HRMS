import React, { useState, useEffect, useRef, useCallback } from "react";
import api, { silentApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import RiderSettings from "./RiderSettings";
import RatingStatsCard from "./RatingStatsCard";
import RatingNotificationsPanel from "./RatingNotificationsPanel";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { orderItemLabel } from "../../utils/orderItemLabel";
import { formatPHP } from "@/lib/utils";
import {
    MapPin,
    Settings,
    Bell,
    Home,
    Package,
    Star,
    LogOut,
    Menu,
    X,
    Clock,
    XCircle,
    Wallet,
    ClipboardList,
} from "lucide-react";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { markStale, STALE_KEYS } from "../../store/dataStore";
import ConfirmModal from "../shared/ConfirmModal";
import NotificationPanel from "../shared/NotificationPanel";
import Tooltip from "../shared/Tooltip";
import SidebarToggle from "../shared/SidebarToggle";
import SidebarSection from "../shared/SidebarSection";

// Haversine distance in km between two GPS points
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
    if (km < 1) return Math.round(km * 1000) + " m";
    if (km < 10) return km.toFixed(1) + " km";
    return Math.round(km) + " km";
}

function formatEta(km) {
    const minutes = Math.round((km / 15) * 60);
    if (minutes < 60) return minutes + " min";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

// Add custom CSS for markers
const markerStyles = `
    .map-marker-container {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .rider-map-blob {
        width: 34px;
        height: 34px;
        background: #ef4444;
        border: 4px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        transition: transform 0.3s ease-out;
    }
    .customer-map-blob {
        width: 32px;
        height: 32px;
        background: #3b82f6;
        border: 4px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
`;

if (typeof document !== "undefined") {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = markerStyles;
    document.head.appendChild(styleSheet);
}

// Function to create icons with dynamic rotation
const createRiderIcon = (heading = 0) =>
    L.divIcon({
        html: `<div class="rider-map-blob" style="transform: rotate(${heading}deg)">🏍️</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        className: "map-marker-container",
    });

const customerIcon = L.divIcon({
    html: '<div class="customer-map-blob">🏠</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "map-marker-container",
});

export default function RiderDashboardV3() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { refreshTrigger: dashTrigger } = useSilentRefresh(
        STALE_KEYS.RIDER_DASHBOARD,
    );
    const { refreshTrigger: notifTrigger } = useSilentRefresh(
        STALE_KEYS.RIDER_NOTIFICATIONS,
    );
    const [view, setView] = useState("dashboard");
    const [showMap, setShowMap] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // State for dashboard data
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        active: 0,
        done: 0,
        total: 0,
        earnings: 0,
        todayEarnings: 0,
        cashToRemitToday: 0,
    });
    const [walletData, setWalletData] = useState({
        today_earnings: 0,
        available: 0,
        pending: 0,
        cash_to_remit_today: 0,
        recent_paid: [],
    });
    // Wave 8 — Delivery History
    const [historyData, setHistoryData] = useState({
        rows: [],
        meta: { current_page: 1, last_page: 1, total: 0 },
    });
    const [historyPage, setHistoryPage] = useState(1);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deliveries, setDeliveries] = useState([]);
    const [nearbyOrders, setNearbyOrders] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [riderPosition, setRiderPosition] = useState(null);
    const riderPositionRef = useRef(null);
    const [showNotifications, setShowNotifications] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: "",
        message: "",
        onConfirm: null,
        variant: "default",
    });
    const showConfirm = (title, message, onConfirm, variant = "default") => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };
    const closeConfirm = () => {
        setConfirmModal({
            show: false,
            title: "",
            message: "",
            onConfirm: null,
            variant: "default",
        });
    };

    // State for order management
    const [assigningOrder, setAssigningOrder] = useState(null);
    const [decliningOrder, setDecliningOrder] = useState(null);
    const [declineNote, setDeclineNote] = useState("");
    const [showDeclineModal, setShowDeclineModal] = useState(false);

    // New Proof of Delivery Modal State
    const [showProofModal, setShowProofModal] = useState(false);
    const [selectedDeliveryToProof, setSelectedDeliveryToProof] =
        useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const [proofError, setProofError] = useState("");
    const [isSubmittingProof, setIsSubmittingProof] = useState(false);

    const [focusedDeliveryId, setFocusedDeliveryId] = useState(null);
    const [uploadingProof, setUploadingProof] = useState(null);

    // Wave 7 — Pause Delivery state
    const [pauseTarget, setPauseTarget] = useState(null); // delivery row to pause
    const [pauseReason, setPauseReason] = useState("");
    const [pauseReasonNote, setPauseReasonNote] = useState(""); // for "Other"
    const [pauseSubmitting, setPauseSubmitting] = useState(false);
    const [pauseError, setPauseError] = useState("");

    // Map and routing state
    const [roadRoutes, setRoadRoutes] = useState({});
    const fileInputRef = useRef(null);
    const mapRef = useRef(null);

    // Refs for preventing memory leaks
    const isMountedRef = useRef(true);
    const routeCacheRef = useRef(new Map());
    const wakeLockRef = useRef(null);

    // Request Screen Wake Lock
    const requestWakeLock = useCallback(async () => {
        if ("wakeLock" in navigator) {
            try {
                wakeLockRef.current =
                    await navigator.wakeLock.request("screen");
                console.log("Screen Wake Lock is active");
            } catch (err) {
                console.error(`Wake Lock error: ${err.name}, ${err.message}`);
            }
        }
    }, []);

    // Release Screen Wake Lock
    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                console.log("Screen Wake Lock released");
            } catch (err) {
                console.error(
                    `Wake Lock Release error: ${err.name}, ${err.message}`,
                );
            }
        }
    }, []);

    // Handle Wake Lock based on active deliveries
    useEffect(() => {
        const hasActiveDeliveries = deliveries.some(
            (d) => d.status === "confirmed" || d.status === "in_progress",
        );

        if (hasActiveDeliveries) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }

        const handleVisibilityChange = async () => {
            if (
                wakeLockRef.current !== null &&
                document.visibilityState === "visible"
            ) {
                await requestWakeLock();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
            releaseWakeLock();
        };
    }, [deliveries, requestWakeLock, releaseWakeLock]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Get real road route using backend proxy
    const getRoadRoute = useCallback(
        async (startLat, startLon, endLat, endLon) => {
            const startLatNum = parseFloat(startLat);
            const startLonNum = parseFloat(startLon);
            const endLatNum = parseFloat(endLat);
            const endLonNum = parseFloat(endLon);

            const cacheKey = `${startLatNum.toFixed(6)},${startLonNum.toFixed(6)}-${endLatNum.toFixed(6)},${endLonNum.toFixed(6)}`;

            if (routeCacheRef.current.has(cacheKey)) {
                return routeCacheRef.current.get(cacheKey);
            }

            try {
                const response = await api.post("/route", {
                    start_lat: startLatNum,
                    start_lon: startLonNum,
                    end_lat: endLatNum,
                    end_lon: endLonNum,
                });

                const data = response.data;

                if (data.features && data.features.length > 0) {
                    const route = data.features[0].geometry.coordinates.map(
                        ([lon, lat]) => [lat, lon],
                    );
                    const routeData = {
                        coordinates: route,
                        distance:
                            data.features[0].properties.segments[0].distance,
                        duration:
                            data.features[0].properties.segments[0].duration,
                    };

                    routeCacheRef.current.set(cacheKey, routeData);
                    return routeData;
                }
                return null;
            } catch (error) {
                console.error("Failed to get road route:", error);
                return null;
            }
        },
        [],
    );

    // Fetch dashboard data
    const fetchData = useCallback(async (silent = false) => {
        if (!isMountedRef.current) return;
        if (!silent) setLoading(true);

        try {
            const currentPos = riderPositionRef.current;
            const params = {};
            if (currentPos) {
                params.latitude = currentPos.lat;
                params.longitude = currentPos.lng;
            }

            const response = await silentApi.get("/riders/me/dashboard", {
                params,
            });
            const { stats: dashStats, my_jobs, nearby } = response.data.data;

            if (isMountedRef.current) {
                setStats({
                    active: dashStats.active || 0,
                    done: dashStats.done || 0,
                    total: dashStats.total || 0,
                    earnings: dashStats.collected || 0,
                    // Wave 6 — rider fee earnings + cash still owed for the day
                    todayEarnings: dashStats.today_earnings || 0,
                    cashToRemitToday: dashStats.cash_to_remit_today || 0,
                });
                setDeliveries(Array.isArray(my_jobs) ? my_jobs : []);
                setNearbyOrders(Array.isArray(nearby) ? nearby : []);
            }
        } catch (error) {
            // Silence background check
        } finally {
            if (isMountedRef.current && !silent) {
                setLoading(false);
            }
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await silentApi.get("/riders/me/notifications");
            if (isMountedRef.current) {
                setNotifications(response.data.data || []);
                setUnreadCount(
                    response.data.data?.filter((n) => !n.read_at).length || 0,
                );
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    }, []);

    // Wave 8 — fetch paginated delivery history when the rider opens the History tab
    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const r = await api.get(
                `/riders/me/history?page=${historyPage}&per_page=20`,
            );
            if (isMountedRef.current) {
                setHistoryData({
                    rows: r.data.data || [],
                    meta: r.data.meta || {
                        current_page: 1,
                        last_page: 1,
                        total: 0,
                    },
                });
            }
        } catch (e) {
            console.error("history fetch failed", e);
        } finally {
            if (isMountedRef.current) setHistoryLoading(false);
        }
    }, [historyPage]);

    // Wave 6 — wallet figures, fetched on-demand when the rider opens the Wallet tab
    const fetchWallet = useCallback(async () => {
        try {
            const r = await silentApi.get("/riders/me/wallet");
            if (isMountedRef.current) setWalletData(r.data.data || {});
        } catch (e) {
            // silent — wallet card will show zeros
        }
    }, []);

    // Initialize data
    useEffect(() => {
        fetchData(deliveries.length > 0 || nearbyOrders.length > 0);
    }, [fetchData, dashTrigger]);

    useEffect(() => {
        fetchNotifications(notifications.length > 0);
    }, [fetchNotifications, notifTrigger]);

    useEffect(() => {
        if (view === "wallet") fetchWallet();
        if (view === "history") fetchHistory();
    }, [view, fetchWallet, fetchHistory, dashTrigger, historyPage]);

    // Real-time synchronization is now handled by the refreshTrigger logic in the effects above

    // Get rider location
    useEffect(() => {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading } = position.coords;
                const newPos = {
                    lat: latitude,
                    lng: longitude,
                    heading: heading || 0,
                };
                setRiderPosition(newPos);
                riderPositionRef.current = newPos;

                // Broadcast location to WebSocket
                if (
                    window.riderWs &&
                    window.riderWs.readyState === WebSocket.OPEN
                ) {
                    window.riderWs.send(
                        JSON.stringify({
                            type: "location",
                            latitude,
                            longitude,
                            broadcast: true,
                        }),
                    );
                }
            },
            (err) => console.warn(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Fetch road routes
    const fetchRoadRoutes = useCallback(async () => {
        if (!isMountedRef.current || !riderPosition) return;

        const allOrders = [...deliveries, ...nearbyOrders];
        const newRoutes = {};
        const routePromises = [];

        for (const order of allOrders) {
            if (order.customer_latitude && order.customer_longitude) {
                const routeKey = `route-${order.id}`;

                if (!roadRoutes[routeKey]) {
                    const promise = getRoadRoute(
                        riderPosition.lat,
                        riderPosition.lng,
                        order.customer_latitude,
                        order.customer_longitude,
                    ).then((route) => {
                        if (route && isMountedRef.current) {
                            newRoutes[routeKey] = route;
                        }
                    });
                    routePromises.push(promise);
                }
            }
        }

        await Promise.all(routePromises);

        if (isMountedRef.current && Object.keys(newRoutes).length > 0) {
            setRoadRoutes((prev) => ({ ...prev, ...newRoutes }));
        }
    }, [deliveries, nearbyOrders, riderPosition, roadRoutes, getRoadRoute]);

    useEffect(() => {
        if (deliveries.length > 0 || nearbyOrders.length > 0) {
            fetchRoadRoutes();
        }
    }, [fetchRoadRoutes]);

    // Format currency (alias of shared formatPHP)
    const formatCurrency = formatPHP;

    // Handle mark notifications read
    const handleMarkNotificationsRead = useCallback(() => {
        if (unreadCount > 0) {
            api.post("/riders/me/notifications/read").then(() => {
                markStale(STALE_KEYS.RIDER_NOTIFICATIONS);
                if (isMountedRef.current) {
                    setUnreadCount(0);
                    setNotifications((prev) =>
                        prev.map((n) => ({ ...n, is_read: true })),
                    );
                }
            });
        }
    }, [unreadCount]);

    // Handle self assign — soft refresh (do NOT reload the whole page)
    const handleSelfAssign = useCallback(async (deliveryId) => {
        setAssigningOrder(deliveryId);
        try {
            await api.post(`/deliveries/${deliveryId}/self-assign`);
            markStale(
                STALE_KEYS.RIDER_DASHBOARD,
                STALE_KEYS.ADMIN_DASHBOARD,
                STALE_KEYS.CUSTOMER_ORDERS,
            );
            await fetchData(true);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to assign order");
        } finally {
            if (isMountedRef.current) {
                setAssigningOrder(null);
            }
        }
    }, []);

    // Handle decline
    const handleDecline = useCallback((deliveryId) => {
        setDecliningOrder(deliveryId);
        setShowDeclineModal(true);
    }, []);

    const confirmDecline = useCallback(async () => {
        if (!declineNote.trim()) {
            alert("Please provide a reason for declining");
            return;
        }
        try {
            await api.post(`/deliveries/${decliningOrder}/decline`, {
                note: declineNote,
            });
            markStale(
                STALE_KEYS.RIDER_DASHBOARD,
                STALE_KEYS.ADMIN_DASHBOARD,
                STALE_KEYS.CUSTOMER_ORDERS,
            );
            await fetchData(true);
            setShowDeclineModal(false);
            setDeclineNote("");
            setDecliningOrder(null);
            alert("Order declined successfully");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to decline order");
        }
    }, [declineNote, decliningOrder, fetchData]);

    // Wave 7 — open the Pause Delivery modal for a row.
    const openPauseModal = useCallback((delivery) => {
        setPauseTarget(delivery);
        setPauseReason("");
        setPauseReasonNote("");
        setPauseError("");
    }, []);

    // Wave 7 — submit pause to backend.
    const submitPause = useCallback(async () => {
        if (!pauseTarget) return;
        const reasonText =
            pauseReason === "Other"
                ? (pauseReasonNote || "").trim()
                : pauseReason;
        if (!reasonText) {
            setPauseError("Please choose a reason.");
            return;
        }
        if (reasonText.length > 255) {
            setPauseError("Reason is too long (max 255 characters).");
            return;
        }
        setPauseSubmitting(true);
        setPauseError("");
        try {
            await api.post(`/deliveries/${pauseTarget.id}/pause`, {
                reason: reasonText,
            });
            markStale(
                STALE_KEYS.RIDER_DASHBOARD,
                STALE_KEYS.ADMIN_DASHBOARD,
                STALE_KEYS.CUSTOMER_ORDERS,
            );
            await fetchData(true);
            setPauseTarget(null);
            setPauseReason("");
            setPauseReasonNote("");
        } catch (err) {
            setPauseError(
                err.response?.data?.message ||
                    "Failed to pause delivery. Try again.",
            );
        } finally {
            if (isMountedRef.current) setPauseSubmitting(false);
        }
    }, [pauseTarget, pauseReason, pauseReasonNote, fetchData]);

    // Wave 7 — resume a paused delivery.
    const resumeDelivery = useCallback(
        async (deliveryId) => {
            try {
                await api.post(`/deliveries/${deliveryId}/resume`);
                markStale(
                    STALE_KEYS.RIDER_DASHBOARD,
                    STALE_KEYS.ADMIN_DASHBOARD,
                    STALE_KEYS.CUSTOMER_ORDERS,
                );
                await fetchData(true);
            } catch (err) {
                alert(
                    err.response?.data?.message || "Failed to resume delivery.",
                );
            }
        },
        [fetchData],
    );

    // Open the proof modal for a given delivery id. Used by the
    // "Upload Proof" button on delivered-but-not-yet-photographed rows.
    const openProofModal = useCallback((deliveryId) => {
        setSelectedDeliveryToProof(deliveryId);
        setProofFile(null);
        setProofPreview(null);
        setProofError("");
        setShowProofModal(true);
    }, []);

    // Handle status change
    const handleStatusChange = useCallback(
        async (deliveryId, newStatus) => {
            try {
                // Wave 6 — when transitioning to delivered, send rider GPS so the
                // backend can stamp mark_delivered_lat/lng + geofence_flag.
                const payload = { status: newStatus };
                if (newStatus === "delivered" && riderPositionRef.current) {
                    payload.rider_latitude = riderPositionRef.current.lat;
                    payload.rider_longitude = riderPositionRef.current.lng;
                }
                await api.put(`/deliveries/${deliveryId}/status`, payload);
                markStale(
                    STALE_KEYS.RIDER_DASHBOARD,
                    STALE_KEYS.ADMIN_DASHBOARD,
                    STALE_KEYS.CUSTOMER_ORDERS,
                );
                if (isMountedRef.current) {
                    const updated = deliveries.map((d) =>
                        d.id === deliveryId ? { ...d, status: newStatus } : d,
                    );
                    setDeliveries(updated);
                }
            } catch (error) {
                console.error("Failed to update status:", error);
            }
        },
        [deliveries],
    );

    // Handle photo upload
    const handlePhotoUpload = useCallback(
        async (deliveryId, file) => {
            const formData = new FormData();
            formData.append("photo", file);
            // Wave 6 — send rider GPS so backend can stamp the geofence flag.
            if (riderPositionRef.current) {
                formData.append(
                    "rider_latitude",
                    String(riderPositionRef.current.lat),
                );
                formData.append(
                    "rider_longitude",
                    String(riderPositionRef.current.lng),
                );
            }
            try {
                await api.post(
                    `/deliveries/${deliveryId}/upload-proof`,
                    formData,
                    {
                        headers: { "Content-Type": "multipart/form-data" },
                    },
                );
                if (isMountedRef.current) {
                    markStale(
                        STALE_KEYS.RIDER_DASHBOARD,
                        STALE_KEYS.ADMIN_DASHBOARD,
                        STALE_KEYS.CUSTOMER_ORDERS,
                    );
                    const updated = deliveries.filter(
                        (d) => d.id !== deliveryId,
                    );
                    setDeliveries(updated);
                    setStats((prev) => ({
                        ...prev,
                        active: Math.max(0, prev.active - 1),
                        done: prev.done + 1,
                    }));
                    // Reset proof state
                    setShowProofModal(false);
                    setSelectedDeliveryToProof(null);
                    setProofFile(null);
                    setProofPreview(null);
                    alert("Delivery confirmed and proof sent!");
                }
            } catch (error) {
                console.error("Failed to upload proof:", error);
                setProofError(
                    error.response?.data?.message ||
                        "Failed to submit proof. Try again.",
                );
            } finally {
                if (isMountedRef.current) {
                    setIsSubmittingProof(false);
                    setUploadingProof(null);
                }
            }
        },
        [deliveries],
    );

    const handleProofFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProofFile(file);
            setProofPreview(URL.createObjectURL(file));
            setProofError("");
        }
    };

    const submitProof = () => {
        if (!proofFile) {
            setProofError("You need to send a proof of delivery image.");
            return;
        }
        setIsSubmittingProof(true);
        handlePhotoUpload(selectedDeliveryToProof, proofFile);
    };

    // Get photo URL
    const getPhotoUrl = useCallback(() => {
        if (user?.photo) {
            return user.photo.startsWith("http")
                ? user.photo
                : `/storage/${user.photo}`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "Rider")}&background=111827&color=fff&size=48`;
    }, [user]);

    if (loading)
        return (
            <div className="loading-page">
                <div className="spinner" />
            </div>
        );

    if (user && user.status === "suspended") {
        return (
            <div className="min-h-screen flex items-center justify-center p-8 bg-secondary/30">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border-red-500/50">
                    <div className="text-lg font-black text-gray-900 mb-6 tracking-tighter">
                        HRMS
                    </div>
                    <div className="mb-4">
                        <XCircle className="h-16 w-16 mx-auto text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-3">
                        Account Suspended
                    </h1>
                    <p className="text-gray-600 leading-relaxed mb-6 max-w-sm mx-auto">
                        Your rider account has been suspended by the management.
                        Please contact support or visit the main office for
                        clarification regarding your account status.
                    </p>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => navigate("/login")}
                            className="w-full py-2.5 border border-red-500/20 text-red-600 rounded-lg hover:bg-red-50 font-semibold text-sm"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (
        user &&
        (user.status === "pending" || user.status === "interview_set")
    ) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8 bg-secondary/30">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border-orange-500/50">
                    <div className="text-lg font-black text-gray-900 mb-6 tracking-tighter">
                        HRMS
                    </div>
                    <div className="mb-4">
                        <Clock className="h-16 w-16 mx-auto text-orange-500" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-3">
                        {user.status === "interview_set"
                            ? "Interview Scheduled"
                            : "Application Pending"}
                    </h1>
                    <p className="text-gray-600 leading-relaxed mb-6 max-w-sm mx-auto">
                        {user.status === "interview_set"
                            ? "Your interview has been scheduled. Please wait for further instructions from the admin."
                            : "Your rider application is under review. Please wait for the admin to schedule an interview or approve your account."}
                    </p>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => navigate("/login")}
                            className="w-full py-2.5 border border-orange-500/20 text-orange-600 rounded-lg hover:bg-orange-50 font-semibold text-sm"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (view === "settings") {
        return <RiderSettings onBack={() => setView("dashboard")} />;
    }

    // Sidebar menu items
    const menuItems = [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "deliveries", label: "Active Deliveries", icon: Package },
        { id: "wallet", label: "Wallet", icon: Wallet },
        { id: "history", label: "Delivery History", icon: ClipboardList },
        { id: "ratings", label: "Ratings", icon: Star },
    ];

    return (
        <div
            style={{
                display: "flex",
                minHeight: "100vh",
                backgroundColor: "#f3f4f6",
            }}
        >
            {/* Sidebar */}
            <div
                style={{
                    width: sidebarOpen ? "260px" : "80px",
                    backgroundColor: "#1f2937",
                    color: "#fff",
                    transition: "width 0.3s ease",
                    position: "fixed",
                    height: "100vh",
                    zIndex: 1000,
                    overflow: "hidden",
                }}
            >
                {/* Sidebar Header */}
                <div
                    style={{
                        padding: "1.5rem",
                        borderBottom: "1px solid #374151",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: sidebarOpen ? "flex-start" : "center",
                        height: "88px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                        }}
                    >
                        <img
                            src={getPhotoUrl()}
                            alt=""
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "10px",
                                objectFit: "cover",
                            }}
                        />
                        {sidebarOpen && (
                            <div>
                                <div
                                    style={{
                                        fontWeight: 700,
                                        fontSize: "0.95rem",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {user?.name || "Rider"}
                                </div>
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                    }}
                                >
                                    Rider
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav
                    style={{
                        padding: "1rem 0",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <SidebarSection
                        label="Main"
                        isCollapsed={!sidebarOpen}
                        className="pt-0"
                    />
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: !sidebarOpen
                                ? "center"
                                : "flex-end",
                            padding: !sidebarOpen
                                ? "0.5rem 0"
                                : "0.5rem 1.5rem",
                            marginBottom: "0.5rem",
                            marginTop: !sidebarOpen ? "-4px" : "-34px",
                        }}
                    >
                        <SidebarToggle
                            isCollapsed={!sidebarOpen}
                            onToggle={() => setSidebarOpen(!sidebarOpen)}
                            size={20}
                        />
                    </div>
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const btn = (
                            <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: sidebarOpen
                                        ? "flex-start"
                                        : "center",
                                    gap: sidebarOpen ? "0.75rem" : "0",
                                    padding: sidebarOpen
                                        ? "0.875rem 1.5rem"
                                        : "0.875rem 0",
                                    backgroundColor:
                                        view === item.id
                                            ? "#374151"
                                            : "transparent",
                                    color: "#fff",
                                    border: "none",
                                    cursor: "pointer",
                                    transition: "background 0.2s",
                                    fontSize: "0.9rem",
                                }}
                                onMouseEnter={(e) => {
                                    if (view !== item.id)
                                        e.target.style.backgroundColor =
                                            "#374151";
                                }}
                                onMouseLeave={(e) => {
                                    if (view !== item.id)
                                        e.target.style.backgroundColor =
                                            "transparent";
                                }}
                            >
                                <Icon size={20} style={{ flexShrink: 0 }} />
                                {sidebarOpen && <span>{item.label}</span>}
                            </button>
                        );
                        return !sidebarOpen ? (
                            <Tooltip
                                key={item.id}
                                label={item.label}
                                position="right"
                                delay={200}
                                className="w-full"
                            >
                                {btn}
                            </Tooltip>
                        ) : (
                            <React.Fragment key={item.id}>{btn}</React.Fragment>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div
                    style={{
                        padding: sidebarOpen ? "1rem 1.5rem" : "1rem 12px",
                        marginTop: "auto",
                    }}
                >
                    <button
                        onClick={logout}
                        title={!sidebarOpen ? "Sign Out" : undefined}
                        aria-label="Sign Out"
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: sidebarOpen
                                ? "flex-start"
                                : "center",
                            gap: sidebarOpen ? "0.75rem" : "0",
                            padding: sidebarOpen ? "0.875rem" : "0.875rem 0",
                            backgroundColor: "#ef4444",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontWeight: 600,
                            transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) =>
                            (e.target.style.backgroundColor = "#dc2626")
                        }
                        onMouseLeave={(e) =>
                            (e.target.style.backgroundColor = "#ef4444")
                        }
                    >
                        <LogOut size={20} style={{ flexShrink: 0 }} />
                        {sidebarOpen && <span>Sign Out</span>}
                    </button>
                </div>
            </div>
            <div
                style={{
                    flex: 1,
                    marginLeft: sidebarOpen ? "260px" : "80px",
                    transition: "margin-left 0.3s ease",
                    padding: "2rem",
                    position: "relative",
                }}
            >
                {/* Global Rider Notifications Bell */}
                <div
                    style={{
                        position: "absolute",
                        top: "2rem",
                        right: "2rem",
                        zIndex: 1001,
                    }}
                >
                    <div style={{ position: "relative" }}>
                        <Tooltip label="Notifications" position="bottom">
                            <button
                                onClick={() =>
                                    setShowNotifications(!showNotifications)
                                }
                                aria-label="Notifications"
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "12px",
                                    backgroundColor: "#fff",
                                    border: "1px solid #e5e7eb",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    position: "relative",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                    transition: "background-color 0.2s",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                        "#f9fafb")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                        "#fff")
                                }
                            >
                                <Bell size={20} color="#4b5563" />
                                {unreadCount > 0 && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            top: "-4px",
                                            right: "-4px",
                                            backgroundColor: "#ef4444",
                                            color: "#fff",
                                            fontSize: "10px",
                                            fontWeight: "bold",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: "50%",
                                            minWidth: "18px",
                                            height: "18px",
                                            border: "2px solid #fff",
                                        }}
                                    >
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </button>
                        </Tooltip>

                        <NotificationPanel
                            notifications={notifications}
                            setNotifications={setNotifications}
                            unreadCount={unreadCount}
                            setUnreadCount={setUnreadCount}
                            isOpen={showNotifications}
                            onClose={() => setShowNotifications(false)}
                            apiPrefix="/riders/me/notifications"
                            markReadUrl="/riders/me/notifications/read"
                            renderMessage={(n) =>
                                n.data?.message || "New notification"
                            }
                            renderLabel={(n) => n.data?.sender_name || "HRMS"}
                            isRead={(n) => !!n.read_at}
                            onRefresh={fetchNotifications}
                            onNotificationClick={(n) => {
                                setShowNotifications(false);
                            }}
                        />
                    </div>
                </div>
                {/* Dashboard View */}
                {view === "dashboard" && (
                    <div>
                        <h1
                            style={{
                                fontSize: "2rem",
                                fontWeight: 800,
                                marginBottom: "2rem",
                                color: "#111827",
                            }}
                        >
                            Dashboard
                        </h1>

                        {/* Stats Grid */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(250px, 1fr))",
                                gap: "1.5rem",
                                marginBottom: "2rem",
                            }}
                        >
                            {[
                                {
                                    label: "Active Orders",
                                    value: stats.active || 0,
                                    color: "#3b82f6",
                                    bg: "#eff6ff",
                                },
                                {
                                    label: "Completed",
                                    value: stats.done || 0,
                                    color: "#10b981",
                                    bg: "#ecfdf5",
                                },
                                {
                                    label: "Today's Earnings",
                                    value: formatCurrency(
                                        stats.todayEarnings || 0,
                                    ),
                                    sub: `Cash to remit today: ${formatCurrency(stats.cashToRemitToday || 0)}`,
                                    color: "#f59e0b",
                                    bg: "#fffbeb",
                                },
                                {
                                    label: "Total Orders",
                                    value: stats.total || 0,
                                    color: "#6b7280",
                                    bg: "#f9fafb",
                                },
                            ].map((stat, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        backgroundColor: "#fff",
                                        borderRadius: "16px",
                                        padding: "1.5rem",
                                        border: "1px solid #e5e7eb",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.875rem",
                                            color: "#6b7280",
                                            marginBottom: "0.5rem",
                                        }}
                                    >
                                        {stat.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "2rem",
                                            fontWeight: 800,
                                            color: stat.color,
                                        }}
                                    >
                                        {stat.value}
                                    </div>
                                    {stat.sub && (
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "#6b7280",
                                                marginTop: "0.25rem",
                                                fontWeight: 500,
                                            }}
                                        >
                                            {stat.sub}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Active Deliveries and Nearby Orders removed from Dashboard tab */}
                    </div>
                )}

                {/* Deliveries View */}
                {view === "deliveries" && (
                    <div>
                        <h1
                            style={{
                                fontSize: "2rem",
                                fontWeight: 800,
                                marginBottom: "2rem",
                                color: "#111827",
                            }}
                        >
                            Active Deliveries
                        </h1>
                        {deliveries.length === 0 ? (
                            <div
                                style={{
                                    backgroundColor: "#fff",
                                    borderRadius: "12px",
                                    padding: "3rem",
                                    textAlign: "center",
                                    border: "1px solid #e5e7eb",
                                }}
                            >
                                <Package
                                    size={48}
                                    style={{
                                        color: "#9ca3af",
                                        margin: "0 auto 1rem",
                                    }}
                                />
                                <p style={{ color: "#6b7280" }}>
                                    No active deliveries
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: "1rem" }}>
                                {/* Wave 7 — paused rows sink to the bottom so the rider sees actionable jobs first. */}
                                {[...deliveries]
                                    .sort((a, b) => {
                                        const ap = a.paused_at ? 1 : 0;
                                        const bp = b.paused_at ? 1 : 0;
                                        return ap - bp;
                                    })
                                    .map((delivery) => (
                                        <div
                                            key={delivery.id}
                                            style={{
                                                backgroundColor: "#fff",
                                                borderRadius: "12px",
                                                padding: "1.5rem",
                                                border: "1px solid #e5e7eb",
                                                borderLeft: delivery.paused_at
                                                    ? "4px solid #f59e0b"
                                                    : "1px solid #e5e7eb",
                                                boxShadow:
                                                    "0 1px 3px rgba(0,0,0,0.1)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    alignItems: "start",
                                                }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: "0.75rem",
                                                            marginBottom:
                                                                "0.5rem",
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                fontSize:
                                                                    "0.875rem",
                                                                fontWeight: 700,
                                                                backgroundColor:
                                                                    "#dbeafe",
                                                                color: "#1e40af",
                                                                padding:
                                                                    "0.25rem 0.75rem",
                                                                borderRadius:
                                                                    "20px",
                                                            }}
                                                        >
                                                            #
                                                            {
                                                                delivery.tracking_number
                                                            }
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize:
                                                                    "0.875rem",
                                                                fontWeight: 600,
                                                                color: "#6b7280",
                                                            }}
                                                        >
                                                            {riderPosition &&
                                                            delivery.customer_latitude &&
                                                            delivery.customer_longitude
                                                                ? formatDistance(
                                                                      haversineKm(
                                                                          riderPosition.lat,
                                                                          riderPosition.lng,
                                                                          delivery.customer_latitude,
                                                                          delivery.customer_longitude,
                                                                      ),
                                                                  )
                                                                : (delivery.distance ??
                                                                  "—")}
                                                        </span>
                                                    </div>
                                                    <h3
                                                        style={{
                                                            fontSize:
                                                                "1.125rem",
                                                            fontWeight: 600,
                                                            marginBottom:
                                                                "0.25rem",
                                                        }}
                                                    >
                                                        {delivery.customer_name}
                                                    </h3>
                                                    <p
                                                        style={{
                                                            color: "#6b7280",
                                                            fontSize:
                                                                "0.875rem",
                                                            marginBottom:
                                                                "0.5rem",
                                                        }}
                                                    >
                                                        {
                                                            delivery.customer_address
                                                        }
                                                    </p>
                                                    {delivery.status ===
                                                        "delivered" &&
                                                        !delivery.proof_photo && (
                                                            <p
                                                                style={{
                                                                    color: "#dc2626",
                                                                    fontSize:
                                                                        "0.75rem",
                                                                    fontWeight: 600,
                                                                    marginBottom:
                                                                        "0.25rem",
                                                                }}
                                                            >
                                                                Awaiting proof
                                                                of delivery
                                                                upload
                                                            </p>
                                                        )}
                                                    <p
                                                        style={{
                                                            color: "#059669",
                                                            fontSize:
                                                                "0.875rem",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        ETA:{" "}
                                                        {riderPosition &&
                                                        delivery.customer_latitude &&
                                                        delivery.customer_longitude
                                                            ? formatEta(
                                                                  haversineKm(
                                                                      riderPosition.lat,
                                                                      riderPosition.lng,
                                                                      delivery.customer_latitude,
                                                                      delivery.customer_longitude,
                                                                  ),
                                                              )
                                                            : (delivery.eta ??
                                                              "—")}
                                                    </p>
                                                </div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: "0.5rem",
                                                        flexWrap: "wrap",
                                                        justifyContent:
                                                            "flex-end",
                                                    }}
                                                >
                                                    {delivery.status ===
                                                        "confirmed" && (
                                                        <button
                                                            onClick={() =>
                                                                handleStatusChange(
                                                                    delivery.id,
                                                                    "in_progress",
                                                                )
                                                            }
                                                            style={{
                                                                padding:
                                                                    "0.5rem 1rem",
                                                                backgroundColor:
                                                                    "#f59e0b",
                                                                color: "#fff",
                                                                border: "none",
                                                                borderRadius:
                                                                    "8px",
                                                                fontWeight: 600,
                                                                cursor: "pointer",
                                                                fontSize:
                                                                    "0.875rem",
                                                            }}
                                                        >
                                                            Start Delivery
                                                        </button>
                                                    )}
                                                    {delivery.status ===
                                                        "in_progress" &&
                                                        !delivery.paused_at && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setFocusedDeliveryId(
                                                                            delivery.id,
                                                                        );
                                                                        setShowMap(
                                                                            true,
                                                                        );
                                                                    }}
                                                                    style={{
                                                                        padding:
                                                                            "0.5rem 1rem",
                                                                        backgroundColor:
                                                                            "#3b82f6",
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius:
                                                                            "8px",
                                                                        fontWeight: 600,
                                                                        cursor: "pointer",
                                                                        fontSize:
                                                                            "0.875rem",
                                                                    }}
                                                                >
                                                                    Location
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        handleStatusChange(
                                                                            delivery.id,
                                                                            "delivered",
                                                                        )
                                                                    }
                                                                    style={{
                                                                        padding:
                                                                            "0.5rem 1rem",
                                                                        backgroundColor:
                                                                            "#10b981",
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius:
                                                                            "8px",
                                                                        fontWeight: 600,
                                                                        cursor: "pointer",
                                                                        fontSize:
                                                                            "0.875rem",
                                                                    }}
                                                                >
                                                                    Mark
                                                                    Delivered
                                                                </button>
                                                                {/* Wave 7 — Pause Delivery */}
                                                                <button
                                                                    onClick={() =>
                                                                        openPauseModal(
                                                                            delivery,
                                                                        )
                                                                    }
                                                                    style={{
                                                                        padding:
                                                                            "0.5rem 1rem",
                                                                        backgroundColor:
                                                                            "#f3f4f6",
                                                                        color: "#374151",
                                                                        border: "1px solid #d1d5db",
                                                                        borderRadius:
                                                                            "8px",
                                                                        fontWeight: 600,
                                                                        cursor: "pointer",
                                                                        fontSize:
                                                                            "0.875rem",
                                                                    }}
                                                                >
                                                                    Pause
                                                                    Delivery
                                                                </button>
                                                            </>
                                                        )}
                                                    {/* Wave 7 — paused state: only the resume button shows here */}
                                                    {delivery.status ===
                                                        "in_progress" &&
                                                        delivery.paused_at && (
                                                            <button
                                                                onClick={() =>
                                                                    resumeDelivery(
                                                                        delivery.id,
                                                                    )
                                                                }
                                                                style={{
                                                                    padding:
                                                                        "0.5rem 1rem",
                                                                    backgroundColor:
                                                                        "#3b82f6",
                                                                    color: "#fff",
                                                                    border: "none",
                                                                    borderRadius:
                                                                        "8px",
                                                                    fontWeight: 600,
                                                                    cursor: "pointer",
                                                                    fontSize:
                                                                        "0.875rem",
                                                                }}
                                                            >
                                                                Resume Delivery
                                                            </button>
                                                        )}
                                                    {delivery.status ===
                                                        "delivered" &&
                                                        !delivery.proof_photo && (
                                                            <button
                                                                onClick={() =>
                                                                    openProofModal(
                                                                        delivery.id,
                                                                    )
                                                                }
                                                                style={{
                                                                    padding:
                                                                        "0.5rem 1rem",
                                                                    backgroundColor:
                                                                        "#10b981",
                                                                    color: "#fff",
                                                                    border: "none",
                                                                    borderRadius:
                                                                        "8px",
                                                                    fontWeight: 600,
                                                                    cursor: "pointer",
                                                                    fontSize:
                                                                        "0.875rem",
                                                                }}
                                                            >
                                                                Upload Proof
                                                            </button>
                                                        )}
                                                </div>
                                            </div>

                                            {/* Wave 7 — Paused banner */}
                                            {delivery.paused_at && (
                                                <div
                                                    style={{
                                                        marginTop: "1rem",
                                                        padding: "0.75rem 1rem",
                                                        backgroundColor:
                                                            "#fffbeb",
                                                        border: "1px solid #fde68a",
                                                        borderRadius: "8px",
                                                        color: "#92400e",
                                                        fontSize: "0.875rem",
                                                        lineHeight: 1.4,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontWeight: 700,
                                                            marginBottom:
                                                                "0.25rem",
                                                        }}
                                                    >
                                                        Delivery Paused
                                                    </div>
                                                    <div>
                                                        <span
                                                            style={{
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            Reason:
                                                        </span>{" "}
                                                        {delivery.pause_reason ||
                                                            "—"}
                                                    </div>
                                                    {delivery.pause_resumes_at && (
                                                        <div>
                                                            <span
                                                                style={{
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                Expected resume:
                                                            </span>{" "}
                                                            {new Date(
                                                                delivery.pause_resumes_at,
                                                            ).toLocaleString(
                                                                [],
                                                                {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                    hour: "numeric",
                                                                    minute: "2-digit",
                                                                },
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}

                        {nearbyOrders.length > 0 && (
                            <div style={{ marginTop: "3rem" }}>
                                <h1
                                    style={{
                                        fontSize: "2rem",
                                        fontWeight: 800,
                                        marginBottom: "2rem",
                                        color: "#111827",
                                    }}
                                >
                                    Nearby Orders
                                </h1>
                                <div style={{ display: "grid", gap: "1rem" }}>
                                    {[...nearbyOrders]
                                        .sort(
                                            (a, b) =>
                                                a.distance_value -
                                                b.distance_value,
                                        )
                                        .map((order) => (
                                            <div
                                                key={order.id}
                                                style={{
                                                    backgroundColor: "#fff",
                                                    borderRadius: "12px",
                                                    padding: "1.5rem",
                                                    border: "1px solid #e5e7eb",
                                                    boxShadow:
                                                        "0 1px 3px rgba(0,0,0,0.1)",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent:
                                                            "space-between",
                                                        alignItems: "start",
                                                    }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                gap: "0.75rem",
                                                                marginBottom:
                                                                    "0.5rem",
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    fontSize:
                                                                        "0.875rem",
                                                                    fontWeight: 700,
                                                                    backgroundColor:
                                                                        "#fef3c7",
                                                                    color: "#b45309",
                                                                    padding:
                                                                        "0.25rem 0.75rem",
                                                                    borderRadius:
                                                                        "20px",
                                                                }}
                                                            >
                                                                #
                                                                {
                                                                    order.tracking_number
                                                                }
                                                            </span>
                                                            <span
                                                                style={{
                                                                    fontSize:
                                                                        "0.875rem",
                                                                    fontWeight: 600,
                                                                    color: "#6b7280",
                                                                }}
                                                            >
                                                                {riderPosition &&
                                                                order.latitude &&
                                                                order.longitude
                                                                    ? `${formatDistance(haversineKm(riderPosition.lat, riderPosition.lng, order.latitude, order.longitude))} • ~${formatEta(haversineKm(riderPosition.lat, riderPosition.lng, order.latitude, order.longitude))}`
                                                                    : (order.distance ??
                                                                      "—")}
                                                            </span>
                                                        </div>
                                                        <h3
                                                            style={{
                                                                fontSize:
                                                                    "1.125rem",
                                                                fontWeight: 600,
                                                                marginBottom:
                                                                    "0.25rem",
                                                            }}
                                                        >
                                                            {
                                                                order.customer_name
                                                            }
                                                        </h3>
                                                        <p
                                                            style={{
                                                                color: "#6b7280",
                                                                fontSize:
                                                                    "0.875rem",
                                                                marginBottom:
                                                                    "0.75rem",
                                                            }}
                                                        >
                                                            {
                                                                order.customer_address
                                                            }
                                                        </p>

                                                        {order.sale?.items && (
                                                            <div
                                                                style={{
                                                                    backgroundColor:
                                                                        "#f9fafb",
                                                                    padding:
                                                                        "0.75rem",
                                                                    borderRadius:
                                                                        "8px",
                                                                    marginBottom:
                                                                        "1rem",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        fontSize:
                                                                            "0.75rem",
                                                                        fontWeight: 700,
                                                                        color: "#6b7280",
                                                                        textTransform:
                                                                            "uppercase",
                                                                        marginBottom:
                                                                            "0.25rem",
                                                                    }}
                                                                >
                                                                    Order Items
                                                                    (
                                                                    {
                                                                        order
                                                                            .sale
                                                                            .items
                                                                            .length
                                                                    }
                                                                    )
                                                                </div>
                                                                <ul
                                                                    style={{
                                                                        margin: 0,
                                                                        paddingLeft:
                                                                            "1.25rem",
                                                                        fontSize:
                                                                            "0.875rem",
                                                                        color: "#4b5563",
                                                                    }}
                                                                >
                                                                    {order.sale.items.map(
                                                                        (
                                                                            item,
                                                                            idx,
                                                                        ) => (
                                                                            <li
                                                                                key={
                                                                                    idx
                                                                                }
                                                                            >
                                                                                {orderItemLabel(
                                                                                    item,
                                                                                )}
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            alignItems:
                                                                "flex-end",
                                                            gap: "1rem",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontSize:
                                                                    "1.25rem",
                                                                fontWeight: 800,
                                                                color: "#111827",
                                                            }}
                                                        >
                                                            {formatCurrency(
                                                                order.sale
                                                                    ?.total_amount,
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                handleSelfAssign(
                                                                    order.id,
                                                                )
                                                            }
                                                            disabled={
                                                                assigningOrder ===
                                                                order.id
                                                            }
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1.5rem",
                                                                backgroundColor:
                                                                    "#111827",
                                                                color: "#fff",
                                                                border: "none",
                                                                borderRadius:
                                                                    "8px",
                                                                fontWeight: 600,
                                                                cursor:
                                                                    assigningOrder ===
                                                                    order.id
                                                                        ? "not-allowed"
                                                                        : "pointer",
                                                                opacity:
                                                                    assigningOrder ===
                                                                    order.id
                                                                        ? 0.7
                                                                        : 1,
                                                                transition:
                                                                    "background-color 0.2s",
                                                            }}
                                                        >
                                                            {assigningOrder ===
                                                            order.id
                                                                ? "Accepting..."
                                                                : "Accept Order"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Wallet View — Wave 6 */}
                {view === "wallet" && (
                    <div>
                        <h1
                            style={{
                                fontSize: "2rem",
                                fontWeight: 800,
                                marginBottom: "0.5rem",
                                color: "#111827",
                            }}
                        >
                            Wallet
                        </h1>
                        <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
                            Earn {formatPHP(30)} per successful delivery.
                            Cash-out is paid manually by admin to your GCash
                            within 24 hours after your day's COD cash is
                            remitted.
                        </p>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(220px, 1fr))",
                                gap: "1.5rem",
                                marginBottom: "2rem",
                            }}
                        >
                            {[
                                {
                                    label: "Today's Earnings",
                                    value: formatCurrency(
                                        walletData.today_earnings || 0,
                                    ),
                                    color: "#f59e0b",
                                },
                                {
                                    label: "Available",
                                    value: formatCurrency(
                                        walletData.available || 0,
                                    ),
                                    color: "#10b981",
                                },
                                {
                                    label: "Pending",
                                    value: formatCurrency(
                                        walletData.pending || 0,
                                    ),
                                    color: "#6b7280",
                                },
                                {
                                    label: "Cash to remit today",
                                    value: formatCurrency(
                                        walletData.cash_to_remit_today || 0,
                                    ),
                                    color: "#3b82f6",
                                },
                            ].map((c, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        backgroundColor: "#fff",
                                        borderRadius: "16px",
                                        padding: "1.5rem",
                                        border: "1px solid #e5e7eb",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "0.875rem",
                                            color: "#6b7280",
                                            marginBottom: "0.5rem",
                                        }}
                                    >
                                        {c.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "2rem",
                                            fontWeight: 800,
                                            color: c.color,
                                        }}
                                    >
                                        {c.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: "16px",
                                padding: "1.5rem",
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                marginBottom: "1.5rem",
                            }}
                        >
                            <h3
                                style={{
                                    fontSize: "1.125rem",
                                    fontWeight: 700,
                                    marginBottom: "0.75rem",
                                    color: "#111827",
                                }}
                            >
                                How cash-out works
                            </h3>
                            <ol
                                style={{
                                    margin: 0,
                                    paddingLeft: "1.25rem",
                                    color: "#4b5563",
                                    fontSize: "0.875rem",
                                    lineHeight: 1.7,
                                }}
                            >
                                <li>
                                    Hand over the day's COD cash to the admin.
                                </li>
                                <li>
                                    Admin marks remittance and your eligible
                                    balance is paid via GCash.
                                </li>
                                <li>
                                    Disputed or geofence-flagged orders go on
                                    hold for admin review.
                                </li>
                            </ol>
                        </div>

                        <div
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: "16px",
                                padding: "1.5rem",
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                            }}
                        >
                            <h3
                                style={{
                                    fontSize: "1.125rem",
                                    fontWeight: 700,
                                    marginBottom: "0.75rem",
                                    color: "#111827",
                                }}
                            >
                                Recent payouts
                            </h3>
                            {walletData.recent_paid &&
                            walletData.recent_paid.length > 0 ? (
                                <ul
                                    style={{
                                        listStyle: "none",
                                        padding: 0,
                                        margin: 0,
                                    }}
                                >
                                    {walletData.recent_paid.map((row) => (
                                        <li
                                            key={row.id}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                padding: "0.5rem 0",
                                                borderBottom:
                                                    "1px solid #f3f4f6",
                                                fontSize: "0.875rem",
                                            }}
                                        >
                                            <span style={{ color: "#4b5563" }}>
                                                {row.tracking_number ||
                                                    `#${row.id}`}
                                            </span>
                                            <span
                                                style={{
                                                    color: "#10b981",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {formatCurrency(
                                                    row.delivery_fee || 0,
                                                )}
                                            </span>
                                            <span style={{ color: "#9ca3af" }}>
                                                {row.paid_at
                                                    ? new Date(
                                                          row.paid_at,
                                                      ).toLocaleDateString()
                                                    : ""}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p
                                    style={{
                                        color: "#6b7280",
                                        fontSize: "0.875rem",
                                        margin: 0,
                                    }}
                                >
                                    No payouts yet.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Wave 8 — Delivery History View */}
                {view === "history" && (
                    <div>
                        <h1
                            style={{
                                fontSize: "2rem",
                                fontWeight: 800,
                                marginBottom: "0.25rem",
                                color: "#111827",
                            }}
                        >
                            Delivery History
                        </h1>
                        <p
                            style={{
                                color: "#6b7280",
                                fontSize: "0.875rem",
                                marginBottom: "1.5rem",
                            }}
                        >
                            {historyData.meta.total} completed deliver
                            {historyData.meta.total === 1 ? "y" : "ies"}
                        </p>

                        <div
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: "12px",
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                overflow: "hidden",
                            }}
                        >
                            {historyLoading ? (
                                <div
                                    style={{
                                        padding: "3rem",
                                        textAlign: "center",
                                        color: "#6b7280",
                                        fontSize: "0.875rem",
                                    }}
                                >
                                    Loading…
                                </div>
                            ) : historyData.rows.length === 0 ? (
                                <div
                                    style={{
                                        padding: "3rem",
                                        textAlign: "center",
                                    }}
                                >
                                    <ClipboardList
                                        size={48}
                                        style={{
                                            color: "#9ca3af",
                                            margin: "0 auto 1rem",
                                        }}
                                    />
                                    <p style={{ color: "#6b7280", margin: 0 }}>
                                        No completed deliveries yet.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            fontSize: "0.875rem",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                backgroundColor: "#f9fafb",
                                            }}
                                        >
                                            <tr>
                                                {[
                                                    "Date",
                                                    "Order #",
                                                    "Customer",
                                                    "Items",
                                                    "Amount",
                                                    "Payment",
                                                    "Status",
                                                    "Payout",
                                                    "Proof",
                                                ].map((h) => (
                                                    <th
                                                        key={h}
                                                        style={{
                                                            padding:
                                                                "0.75rem 1rem",
                                                            textAlign: "left",
                                                            fontWeight: 700,
                                                            color: "#374151",
                                                            fontSize: "0.75rem",
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing:
                                                                "0.05em",
                                                            borderBottom:
                                                                "1px solid #e5e7eb",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyData.rows.map((row) => {
                                                const dt = row.delivered_at
                                                    ? new Date(row.delivered_at)
                                                    : null;
                                                const dtText = dt
                                                    ? dt.toLocaleString([], {
                                                          month: "short",
                                                          day: "numeric",
                                                          year: "numeric",
                                                          hour: "numeric",
                                                          minute: "2-digit",
                                                      })
                                                    : "—";

                                                const statusChip = (() => {
                                                    const map = {
                                                        delivered: {
                                                            bg: "#ecfdf5",
                                                            fg: "#047857",
                                                        },
                                                        failed: {
                                                            bg: "#fef2f2",
                                                            fg: "#b91c1c",
                                                        },
                                                    };
                                                    const c = map[
                                                        row.status
                                                    ] || {
                                                        bg: "#f3f4f6",
                                                        fg: "#374151",
                                                    };
                                                    return (
                                                        <span
                                                            style={{
                                                                backgroundColor:
                                                                    c.bg,
                                                                color: c.fg,
                                                                padding:
                                                                    "0.125rem 0.5rem",
                                                                borderRadius:
                                                                    "999px",
                                                                fontWeight: 700,
                                                                fontSize:
                                                                    "0.75rem",
                                                                textTransform:
                                                                    "capitalize",
                                                            }}
                                                        >
                                                            {row.status}
                                                        </span>
                                                    );
                                                })();

                                                const payoutMap = {
                                                    paid: {
                                                        bg: "#ecfdf5",
                                                        fg: "#047857",
                                                    },
                                                    eligible: {
                                                        bg: "#eff6ff",
                                                        fg: "#1d4ed8",
                                                    },
                                                    pending: {
                                                        bg: "#f3f4f6",
                                                        fg: "#374151",
                                                    },
                                                    held: {
                                                        bg: "#fffbeb",
                                                        fg: "#92400e",
                                                    },
                                                    rejected: {
                                                        bg: "#fef2f2",
                                                        fg: "#b91c1c",
                                                    },
                                                };
                                                const pc = payoutMap[
                                                    row.payout_status
                                                ] || {
                                                    bg: "#f3f4f6",
                                                    fg: "#374151",
                                                };

                                                return (
                                                    <tr
                                                        key={row.id}
                                                        style={{
                                                            borderBottom:
                                                                "1px solid #f3f4f6",
                                                        }}
                                                    >
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                                color: "#111827",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            {dtText}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                                color: "#1d4ed8",
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            #{row.order_id}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                                color: "#374151",
                                                            }}
                                                        >
                                                            {row.customer_name ||
                                                                "—"}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                                color: "#6b7280",
                                                            }}
                                                        >
                                                            {row.item_count}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                                color: "#111827",
                                                                fontWeight: 600,
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            {formatPHP(
                                                                row.amount,
                                                            )}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                                color: "#374151",
                                                                textTransform:
                                                                    "uppercase",
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {row.payment_method ||
                                                                "—"}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            {statusChip}
                                                            {row.geofence_flagged && (
                                                                <span
                                                                    style={{
                                                                        marginLeft:
                                                                            "0.375rem",
                                                                        backgroundColor:
                                                                            "#fffbeb",
                                                                        color: "#92400e",
                                                                        padding:
                                                                            "0.125rem 0.5rem",
                                                                        borderRadius:
                                                                            "999px",
                                                                        fontWeight: 700,
                                                                        fontSize:
                                                                            "0.75rem",
                                                                    }}
                                                                >
                                                                    flagged
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    backgroundColor:
                                                                        pc.bg,
                                                                    color: pc.fg,
                                                                    padding:
                                                                        "0.125rem 0.5rem",
                                                                    borderRadius:
                                                                        "999px",
                                                                    fontWeight: 700,
                                                                    fontSize:
                                                                        "0.75rem",
                                                                    textTransform:
                                                                        "capitalize",
                                                                }}
                                                            >
                                                                {row.payout_status ||
                                                                    "—"}
                                                            </span>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding:
                                                                    "0.75rem 1rem",
                                                            }}
                                                        >
                                                            {row.proof_photo_url ? (
                                                                <a
                                                                    href={
                                                                        row.proof_photo_url
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{
                                                                        color: "#1d4ed8",
                                                                        fontWeight: 600,
                                                                        textDecoration:
                                                                            "none",
                                                                    }}
                                                                >
                                                                    View proof
                                                                </a>
                                                            ) : (
                                                                <span
                                                                    style={{
                                                                        color: "#9ca3af",
                                                                    }}
                                                                >
                                                                    —
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {historyData.rows.length > 0 && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginTop: "1rem",
                                    fontSize: "0.875rem",
                                    color: "#6b7280",
                                }}
                            >
                                <span>
                                    Showing page {historyData.meta.current_page}{" "}
                                    of {historyData.meta.last_page}
                                </span>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        onClick={() =>
                                            setHistoryPage(historyPage - 1)
                                        }
                                        disabled={
                                            historyData.meta.current_page <=
                                                1 || historyLoading
                                        }
                                        style={{
                                            padding: "0.5rem 1rem",
                                            backgroundColor: "#fff",
                                            color: "#374151",
                                            border: "1px solid #d1d5db",
                                            borderRadius: "8px",
                                            fontWeight: 600,
                                            cursor:
                                                historyData.meta.current_page <=
                                                1
                                                    ? "not-allowed"
                                                    : "pointer",
                                            opacity:
                                                historyData.meta.current_page <=
                                                1
                                                    ? 0.5
                                                    : 1,
                                            fontSize: "0.875rem",
                                        }}
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() =>
                                            setHistoryPage(historyPage + 1)
                                        }
                                        disabled={
                                            historyData.meta.current_page >=
                                                historyData.meta.last_page ||
                                            historyLoading
                                        }
                                        style={{
                                            padding: "0.5rem 1rem",
                                            backgroundColor: "#3b82f6",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "8px",
                                            fontWeight: 600,
                                            cursor:
                                                historyData.meta.current_page >=
                                                historyData.meta.last_page
                                                    ? "not-allowed"
                                                    : "pointer",
                                            opacity:
                                                historyData.meta.current_page >=
                                                historyData.meta.last_page
                                                    ? 0.5
                                                    : 1,
                                            fontSize: "0.875rem",
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Ratings View */}
                {view === "ratings" && (
                    <div>
                        <h1
                            style={{
                                fontSize: "2rem",
                                fontWeight: 800,
                                marginBottom: "2rem",
                                color: "#111827",
                            }}
                        >
                            Ratings & Reviews
                        </h1>
                        <RatingStatsCard />
                        <div style={{ marginTop: "2rem" }}>
                            <RatingNotificationsPanel />
                        </div>
                    </div>
                )}
            </div>

            {/* Map Modal */}
            {showMap && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 2000,
                        backgroundColor: "#fff",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: 20,
                            left: 20,
                            zIndex: 2001,
                        }}
                    >
                        <button
                            onClick={() => setShowMap(false)}
                            style={{
                                background: "#111827",
                                color: "#fff",
                                border: "none",
                                padding: "0.75rem 1.5rem",
                                borderRadius: "10px",
                                fontWeight: 600,
                                cursor: "pointer",
                                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                            }}
                        >
                            ✕ Close Map
                        </button>
                    </div>

                    {/* Map Legend */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: 30,
                            right: 20,
                            zIndex: 2001,
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                            padding: "12px 16px",
                            borderRadius: "12px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    backgroundColor: "#ef4444",
                                }}
                            ></div>
                            <span
                                style={{
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "#4b5563",
                                }}
                            >
                                Rider (You)
                            </span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    backgroundColor: "#3b82f6",
                                }}
                            ></div>
                            <span
                                style={{
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "#4b5563",
                                }}
                            >
                                Customer
                            </span>
                        </div>
                    </div>
                    <MapContainer
                        center={
                            riderPosition
                                ? [riderPosition.lat, riderPosition.lng]
                                : [7.0707, 125.608]
                        }
                        zoom={13}
                        style={{ height: "100%", width: "100%" }}
                        zoomControl={true}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        {riderPosition && (
                            <Marker
                                position={[
                                    riderPosition.lat,
                                    riderPosition.lng,
                                ]}
                                icon={createRiderIcon(riderPosition.heading)}
                            >
                                <Popup>You are here</Popup>
                            </Marker>
                        )}

                        {[...deliveries, ...nearbyOrders]
                            .filter((d) =>
                                focusedDeliveryId
                                    ? d.id === focusedDeliveryId
                                    : true,
                            )
                            .map((d) => {
                                const routeKey = `route-${d.id}`;
                                const roadRoute = roadRoutes[routeKey];
                                if (
                                    !d.customer_latitude ||
                                    !d.customer_longitude ||
                                    !riderPosition
                                )
                                    return null;

                                const positions = roadRoute
                                    ? roadRoute.coordinates
                                    : [
                                          [
                                              riderPosition.lat,
                                              riderPosition.lng,
                                          ],
                                          [
                                              d.customer_latitude,
                                              d.customer_longitude,
                                          ],
                                      ];
                                return (
                                    <React.Fragment key={routeKey}>
                                        <Polyline
                                            positions={positions}
                                            color={
                                                roadRoute
                                                    ? "#10b981"
                                                    : "#3b82f6"
                                            }
                                            weight={3}
                                            opacity={0.8}
                                        />
                                        <Marker
                                            position={[
                                                d.customer_latitude,
                                                d.customer_longitude,
                                            ]}
                                            icon={customerIcon}
                                        >
                                            <Popup>
                                                <div>
                                                    <strong>
                                                        Order #
                                                        {d.tracking_number ||
                                                            d.order_id}
                                                    </strong>
                                                    <br />
                                                    {d.customer_address}
                                                    <br />
                                                    <small>
                                                        Distance:{" "}
                                                        {riderPosition &&
                                                        d.customer_latitude &&
                                                        d.customer_longitude
                                                            ? formatDistance(
                                                                  haversineKm(
                                                                      riderPosition.lat,
                                                                      riderPosition.lng,
                                                                      d.customer_latitude,
                                                                      d.customer_longitude,
                                                                  ),
                                                              )
                                                            : (d.distance ??
                                                              "—")}
                                                    </small>
                                                    <br />
                                                    <small>
                                                        ETA:{" "}
                                                        {riderPosition &&
                                                        d.customer_latitude &&
                                                        d.customer_longitude
                                                            ? formatEta(
                                                                  haversineKm(
                                                                      riderPosition.lat,
                                                                      riderPosition.lng,
                                                                      d.customer_latitude,
                                                                      d.customer_longitude,
                                                                  ),
                                                              )
                                                            : (d.eta ?? "—")}
                                                    </small>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    </React.Fragment>
                                );
                            })}
                    </MapContainer>
                </div>
            )}

            {/* Wave 7 — Pause Delivery Modal */}
            {pauseTarget && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "1rem",
                    }}
                    onClick={() => !pauseSubmitting && setPauseTarget(null)}
                >
                    <div
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: "12px",
                            padding: "1.5rem",
                            width: "100%",
                            maxWidth: "420px",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2
                            style={{
                                fontSize: "1.25rem",
                                fontWeight: 800,
                                color: "#111827",
                                marginBottom: "0.25rem",
                            }}
                        >
                            Pause Delivery
                        </h2>
                        <p
                            style={{
                                fontSize: "0.875rem",
                                color: "#6b7280",
                                marginBottom: "1rem",
                            }}
                        >
                            Order #{pauseTarget.tracking_number} — Why are you
                            pausing this delivery?
                        </p>

                        <div
                            style={{
                                display: "grid",
                                gap: "0.5rem",
                                marginBottom: "0.75rem",
                            }}
                        >
                            {[
                                "Heavy rain",
                                "Vehicle issue",
                                "Customer not reachable",
                                "Other",
                            ].map((opt) => (
                                <label
                                    key={opt}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        padding: "0.625rem 0.75rem",
                                        border:
                                            pauseReason === opt
                                                ? "2px solid #f59e0b"
                                                : "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        backgroundColor:
                                            pauseReason === opt
                                                ? "#fffbeb"
                                                : "#fff",
                                        fontSize: "0.875rem",
                                        fontWeight: 600,
                                        color: "#374151",
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="pause_reason"
                                        value={opt}
                                        checked={pauseReason === opt}
                                        onChange={() => setPauseReason(opt)}
                                        disabled={pauseSubmitting}
                                    />
                                    {opt}
                                </label>
                            ))}
                        </div>

                        {pauseReason === "Other" && (
                            <textarea
                                value={pauseReasonNote}
                                onChange={(e) =>
                                    setPauseReasonNote(e.target.value)
                                }
                                maxLength={255}
                                rows={3}
                                placeholder="Specify the reason..."
                                disabled={pauseSubmitting}
                                style={{
                                    width: "100%",
                                    padding: "0.625rem 0.75rem",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    fontSize: "0.875rem",
                                    resize: "none",
                                    marginBottom: "0.75rem",
                                    fontFamily: "inherit",
                                }}
                            />
                        )}

                        {pauseError && (
                            <p
                                style={{
                                    color: "#dc2626",
                                    fontSize: "0.8125rem",
                                    marginBottom: "0.75rem",
                                }}
                            >
                                {pauseError}
                            </p>
                        )}

                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                                onClick={() => setPauseTarget(null)}
                                disabled={pauseSubmitting}
                                style={{
                                    flex: 1,
                                    padding: "0.75rem",
                                    backgroundColor: "#f3f4f6",
                                    color: "#111827",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitPause}
                                disabled={pauseSubmitting || !pauseReason}
                                style={{
                                    flex: 1,
                                    padding: "0.75rem",
                                    backgroundColor: "#f59e0b",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                    cursor: pauseSubmitting
                                        ? "not-allowed"
                                        : "pointer",
                                    opacity:
                                        pauseSubmitting || !pauseReason
                                            ? 0.6
                                            : 1,
                                }}
                            >
                                {pauseSubmitting
                                    ? "Pausing..."
                                    : "Confirm Pause"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Proof of Delivery Modal */}
            {showProofModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 3000,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: "12px",
                            padding: "2rem",
                            width: "90%",
                            maxWidth: "400px",
                        }}
                    >
                        <h3
                            style={{
                                fontSize: "1.25rem",
                                fontWeight: 700,
                                marginBottom: "0.5rem",
                            }}
                        >
                            Delivery Proof
                        </h3>
                        <p
                            style={{
                                color: "#6b7280",
                                fontSize: "0.875rem",
                                marginBottom: "1.5rem",
                            }}
                        >
                            Please provide a photo as proof of delivery to mark
                            this order as delivered.
                        </p>

                        <div style={{ marginBottom: "1.5rem" }}>
                            {proofPreview ? (
                                <div
                                    style={{
                                        position: "relative",
                                        marginBottom: "1rem",
                                    }}
                                >
                                    <img
                                        src={proofPreview}
                                        alt="Proof Preview"
                                        style={{
                                            width: "100%",
                                            borderRadius: "8px",
                                            maxHeight: "200px",
                                            objectFit: "contain",
                                            backgroundColor: "#f3f4f6",
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            setProofFile(null);
                                            setProofPreview(null);
                                        }}
                                        style={{
                                            position: "absolute",
                                            top: 8,
                                            right: 8,
                                            background: "#ef4444",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "50%",
                                            width: 24,
                                            height: 24,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: "bold",
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <label
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "2px dashed #d1d5db",
                                        borderRadius: "8px",
                                        padding: "2rem 1rem",
                                        cursor: "pointer",
                                        backgroundColor: "#f9fafb",
                                        color: "#6b7280",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: "2rem",
                                            marginBottom: "0.5rem",
                                        }}
                                    >
                                        📸
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "0.875rem",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Tap to capture or upload photo
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleProofFileChange}
                                        style={{ display: "none" }}
                                    />
                                </label>
                            )}

                            {proofError && (
                                <div
                                    style={{
                                        color: "#ef4444",
                                        fontSize: "0.875rem",
                                        marginTop: "0.5rem",
                                        fontWeight: 500,
                                    }}
                                >
                                    {proofError}
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                                onClick={() => {
                                    setShowProofModal(false);
                                    setSelectedDeliveryToProof(null);
                                    setProofFile(null);
                                    setProofPreview(null);
                                    setProofError("");
                                }}
                                disabled={isSubmittingProof}
                                style={{
                                    flex: 1,
                                    padding: "0.75rem",
                                    backgroundColor: "#f3f4f6",
                                    color: "#111827",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitProof}
                                disabled={isSubmittingProof}
                                style={{
                                    flex: 1,
                                    padding: "0.75rem",
                                    backgroundColor: "#10b981",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    opacity: isSubmittingProof ? 0.7 : 1,
                                }}
                            >
                                {isSubmittingProof
                                    ? "Sending..."
                                    : "Submit Proof"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Decline Modal */}
            {showDeclineModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 3000,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: "12px",
                            padding: "2rem",
                            width: "90%",
                            maxWidth: "400px",
                        }}
                    >
                        <h3
                            style={{
                                fontSize: "1.25rem",
                                fontWeight: 700,
                                marginBottom: "1rem",
                            }}
                        >
                            Decline Order
                        </h3>
                        <textarea
                            value={declineNote}
                            onChange={(e) => setDeclineNote(e.target.value)}
                            placeholder="Please provide a reason for declining..."
                            style={{
                                width: "100%",
                                minHeight: "100px",
                                padding: "0.75rem",
                                border: "1px solid #d1d5db",
                                borderRadius: "8px",
                                resize: "vertical",
                                fontSize: "0.875rem",
                            }}
                        />
                        <div
                            style={{
                                display: "flex",
                                gap: "0.75rem",
                                marginTop: "1rem",
                            }}
                        >
                            <button
                                onClick={() => {
                                    setShowDeclineModal(false);
                                    setDeclineNote("");
                                    setDecliningOrder(null);
                                }}
                                style={{
                                    flex: 1,
                                    padding: "0.75rem",
                                    backgroundColor: "#f3f4f6",
                                    color: "#111827",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDecline}
                                style={{
                                    flex: 1,
                                    padding: "0.75rem",
                                    backgroundColor: "#ef4444",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
