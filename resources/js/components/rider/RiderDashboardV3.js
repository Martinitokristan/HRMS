import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import RiderSettings from './RiderSettings';
import RatingStatsCard from './RatingStatsCard';
import RatingNotificationsPanel from './RatingNotificationsPanel';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    MapPin,
    Settings,
    Bell,
    Home,
    Package,
    Star,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

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

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = markerStyles;
    document.head.appendChild(styleSheet);
}

// Function to create icons with dynamic rotation
const createRiderIcon = (heading = 0) => L.divIcon({
    html: `<div class="rider-map-blob" style="transform: rotate(${heading}deg)">🏍️</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    className: 'map-marker-container'
});

const customerIcon = L.divIcon({
    html: '<div class="customer-map-blob">🏠</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: 'map-marker-container'
});

export default function RiderDashboardV3() {
    const { user, logout } = useAuth();
    const { refreshTrigger: dashTrigger } = useSilentRefresh('rider_dashboard');
    const { refreshTrigger: notifTrigger } = useSilentRefresh('rider_notifications');
    const [view, setView] = useState('dashboard');
    const [showMap, setShowMap] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // State for dashboard data
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ active: 0, done: 0, total: 0, earnings: 0 });
    const [deliveries, setDeliveries] = useState([]);
    const [nearbyOrders, setNearbyOrders] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [riderPosition, setRiderPosition] = useState(null);
    const riderPositionRef = useRef(null);
    const [showNotifications, setShowNotifications] = useState(false);

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

    // State for order management
    const [assigningOrder, setAssigningOrder] = useState(null);
    const [decliningOrder, setDecliningOrder] = useState(null);
    const [declineNote, setDeclineNote] = useState('');
    const [showDeclineModal, setShowDeclineModal] = useState(false);

    // New Proof of Delivery Modal State
    const [showProofModal, setShowProofModal] = useState(false);
    const [selectedDeliveryToProof, setSelectedDeliveryToProof] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const [proofError, setProofError] = useState('');
    const [isSubmittingProof, setIsSubmittingProof] = useState(false);

    const [focusedDeliveryId, setFocusedDeliveryId] = useState(null);
    const [uploadingProof, setUploadingProof] = useState(null);

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
        if ('wakeLock' in navigator) {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active');
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
                console.log('Screen Wake Lock released');
            } catch (err) {
                console.error(`Wake Lock Release error: ${err.name}, ${err.message}`);
            }
        }
    }, []);

    // Handle Wake Lock based on active deliveries
    useEffect(() => {
        const hasActiveDeliveries = deliveries.some(d => d.status === 'confirmed' || d.status === 'in_progress');

        if (hasActiveDeliveries) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }

        const handleVisibilityChange = async () => {
            if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
                await requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    const getRoadRoute = useCallback(async (startLat, startLon, endLat, endLon) => {
        const startLatNum = parseFloat(startLat);
        const startLonNum = parseFloat(startLon);
        const endLatNum = parseFloat(endLat);
        const endLonNum = parseFloat(endLon);

        const cacheKey = `${startLatNum.toFixed(6)},${startLonNum.toFixed(6)}-${endLatNum.toFixed(6)},${endLonNum.toFixed(6)}`;

        if (routeCacheRef.current.has(cacheKey)) {
            return routeCacheRef.current.get(cacheKey);
        }

        try {
            const response = await axios.post('/route', {
                start_lat: startLatNum,
                start_lon: startLonNum,
                end_lat: endLatNum,
                end_lon: endLonNum
            });

            const data = response.data;

            if (data.features && data.features.length > 0) {
                const route = data.features[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
                const routeData = {
                    coordinates: route,
                    distance: data.features[0].properties.segments[0].distance,
                    duration: data.features[0].properties.segments[0].duration
                };

                routeCacheRef.current.set(cacheKey, routeData);
                return routeData;
            }
            return null;
        } catch (error) {
            console.error('Failed to get road route:', error);
            return null;
        }
    }, []);

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
                params.heading = currentPos.heading || 0;
            }

            const response = await axios.get('/riders/me/dashboard', { params });
            const { stats: dashStats, my_jobs, nearby } = response.data.data;

            if (isMountedRef.current) {
                setStats({
                    active: dashStats.active || 0,
                    done: dashStats.done || 0,
                    total: dashStats.total || 0,
                    earnings: dashStats.collected || 0
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

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        try {
            const response = await axios.get('/riders/me/notifications');
            if (isMountedRef.current) {
                setNotifications(response.data.data || []);
                setUnreadCount(response.data.data?.filter(n => !n.read_at).length || 0);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
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
        const interval = setInterval(() => fetchData(true), 5000); // refresh every 5s for smoother tracking
        return () => clearInterval(interval);
    }, [fetchData]);

    // Get rider location
    useEffect(() => {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading } = position.coords;
                const newPos = { lat: latitude, lng: longitude, heading: heading || 0 };
                setRiderPosition(newPos);
                riderPositionRef.current = newPos;

                // Broadcast location to WebSocket
                if (window.riderWs && window.riderWs.readyState === WebSocket.OPEN) {
                    window.riderWs.send(JSON.stringify({
                        type: 'location',
                        latitude,
                        longitude,
                        heading: heading || 0,
                        broadcast: true
                    }));
                }
            },
            (err) => console.warn(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
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
                        riderPosition.lat, riderPosition.lng,
                        order.customer_latitude, order.customer_longitude
                    ).then(route => {
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
            setRoadRoutes(prev => ({ ...prev, ...newRoutes }));
        }
    }, [deliveries, nearbyOrders, riderPosition, roadRoutes, getRoadRoute]);

    useEffect(() => {
        if (deliveries.length > 0 || nearbyOrders.length > 0) {
            fetchRoadRoutes();
        }
    }, [fetchRoadRoutes]);

    // Format currency
    const formatCurrency = useCallback((amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(amount || 0);
    }, []);

    // Handle mark notifications read
    const handleMarkNotificationsRead = useCallback(() => {
        if (unreadCount > 0) {
            axios.post('/riders/me/notifications/read').then(() => {
                if (isMountedRef.current) {
                    setUnreadCount(0);
                    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                }
            });
        }
    }, [unreadCount]);

    // Handle self assign
    const handleSelfAssign = useCallback(async (deliveryId) => {
        setAssigningOrder(deliveryId);
        try {
            await axios.post(`/deliveries/${deliveryId}/self-assign`);
            markStale('rider_dashboard', 'admin_dashboard', 'customer_dashboard');
            await fetchData(true);
            alert('Order assigned successfully!');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to assign order');
        } finally {
            if (isMountedRef.current) {
                setAssigningOrder(null);
            }
        }
    }, [fetchData]);

    // Handle decline
    const handleDecline = useCallback((deliveryId) => {
        setDecliningOrder(deliveryId);
        setShowDeclineModal(true);
    }, []);

    const confirmDecline = useCallback(async () => {
        if (!declineNote.trim()) {
            alert('Please provide a reason for declining');
            return;
        }
        try {
            await axios.post(`/deliveries/${decliningOrder}/decline`, { note: declineNote });
            markStale('rider_dashboard', 'admin_dashboard', 'customer_dashboard');
            await fetchData(true);
            setShowDeclineModal(false);
            setDeclineNote('');
            setDecliningOrder(null);
            alert('Order declined successfully');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to decline order');
        }
    }, [declineNote, decliningOrder, fetchData]);

    // Handle status change
    const handleStatusChange = useCallback(async (deliveryId, newStatus) => {
        try {
            await axios.put(`/deliveries/${deliveryId}/status`, { status: newStatus });
            markStale('rider_dashboard', 'admin_dashboard', 'customer_dashboard');
            if (isMountedRef.current) {
                const updated = deliveries.map(d =>
                    d.id === deliveryId ? { ...d, status: newStatus } : d
                );
                setDeliveries(updated);
                if (newStatus === 'delivered') {
                    // Instead of instantly clicking file upload, open modal.
                    setSelectedDeliveryToProof(deliveryId);
                    setProofFile(null);
                    setProofPreview(null);
                    setProofError('');
                    setShowProofModal(true);
                }
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    }, [deliveries]);

    // Handle photo upload
    const handlePhotoUpload = useCallback(async (deliveryId, file) => {
        const formData = new FormData();
        formData.append('photo', file);
        try {
            await axios.post(`/deliveries/${deliveryId}/upload-proof`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (isMountedRef.current) {
                markStale('rider_dashboard', 'admin_dashboard', 'customer_dashboard');
                const updated = deliveries.filter(d => d.id !== deliveryId);
                setDeliveries(updated);
                setStats(prev => ({
                    ...prev,
                    active: Math.max(0, prev.active - 1),
                    done: prev.done + 1
                }));
                // Reset proof state
                setShowProofModal(false);
                setSelectedDeliveryToProof(null);
                setProofFile(null);
                setProofPreview(null);
                alert("Delivery confirmed and proof sent!");
            }
        } catch (error) {
            console.error('Failed to upload proof:', error);
            setProofError(error.response?.data?.message || 'Failed to submit proof. Try again.');
        } finally {
            if (isMountedRef.current) {
                setIsSubmittingProof(false);
                setUploadingProof(null);
            }
        }
    }, [deliveries]);

    const handleProofFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProofFile(file);
            setProofPreview(URL.createObjectURL(file));
            setProofError('');
        }
    };

    const submitProof = () => {
        if (!proofFile) {
            setProofError('You need to send a proof of delivery image.');
            return;
        }
        setIsSubmittingProof(true);
        handlePhotoUpload(selectedDeliveryToProof, proofFile);
    };

    // Get photo URL
    const getPhotoUrl = useCallback(() => {
        if (user?.photo) {
            return user.photo.startsWith('http') ? user.photo : `/storage/${user.photo}`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Rider')}&background=111827&color=fff&size=48`;
    }, [user]);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    if (view === 'settings') {
        return <RiderSettings onBack={() => setView('dashboard')} />;
    }

    // Sidebar menu items
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'deliveries', label: 'Active Deliveries', icon: Package },
        { id: 'ratings', label: 'Ratings', icon: Star },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
            {/* Sidebar */}
            <div style={{
                width: sidebarOpen ? '260px' : '60px',
                backgroundColor: '#1f2937',
                color: '#fff',
                transition: 'width 0.3s ease',
                position: 'fixed',
                height: '100vh',
                zIndex: 1000,
                overflow: 'hidden'
            }}>
                {/* Sidebar Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: sidebarOpen ? 'space-between' : 'center'
                }}>
                    {sidebarOpen && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img
                                src={getPhotoUrl()}
                                alt=""
                                style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }}
                            />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{user?.name || 'Rider'}</div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Rider</div>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#374151'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav style={{ padding: '1rem 0' }}>
                    {menuItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.875rem 1.5rem',
                                    backgroundColor: view === item.id ? '#374151' : 'transparent',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    fontSize: '0.9rem'
                                }}
                                onMouseEnter={(e) => {
                                    if (view !== item.id) e.target.style.backgroundColor = '#374151';
                                }}
                                onMouseLeave={(e) => {
                                    if (view !== item.id) e.target.style.backgroundColor = 'transparent';
                                }}
                            >
                                <Icon size={20} style={{ flexShrink: 0 }} />
                                {sidebarOpen && <span>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* Removed Global Map Button */}

                {/* Logout */}
                <div style={{ padding: '1rem 1.5rem', marginTop: 'auto' }}>
                    <button
                        onClick={logout}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.875rem',
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                    >
                        <LogOut size={20} />
                        {sidebarOpen && <span>Sign Out</span>}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                flex: 1,
                marginLeft: sidebarOpen ? '260px' : '60px',
                transition: 'margin-left 0.3s ease',
                padding: '2rem',
                position: 'relative'
            }}>
                {/* Global Rider Notifications Bell */}
                <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 50 }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                backgroundColor: '#fff',
                                border: '1px solid #e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                position: 'relative',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                            <Bell size={20} color="#4b5563" />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    backgroundColor: '#ef4444',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    minWidth: '18px',
                                    height: '18px',
                                    border: '2px solid #fff'
                                }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowNotifications(false)} />
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 10px)',
                                    right: 0,
                                    width: '320px',
                                    maxHeight: '400px',
                                    backgroundColor: '#fff',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                    borderRadius: '16px',
                                    border: '1px solid #e5e7eb',
                                    zIndex: 100,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '15px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>Notifications</div>
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                                                No notifications
                                            </div>
                                        ) : notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                style={{
                                                    padding: '15px 20px',
                                                    borderBottom: '1px solid #f3f4f6',
                                                    backgroundColor: notif.read_at ? '#fff' : '#eff6ff',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (notif.read_at) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                                                onMouseLeave={(e) => { if (notif.read_at) e.currentTarget.style.backgroundColor = '#fff'; }}
                                                onClick={() => {
                                                    if (!notif.read_at) {
                                                        axios.post('/notifications/mark-all-read').then(() => {
                                                            setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
                                                            setUnreadCount(0);
                                                        });
                                                    }
                                                    setShowNotifications(false);
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#FF6B35', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                        {notif.data?.sender_name || 'HRMS'}
                                                    </span>
                                                    <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 'normal' }}>
                                                        {new Date(notif.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#111827', lineHeight: '1.4', fontWeight: notif.read_at ? 'normal' : '600' }}>
                                                    {notif.data?.message}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                {/* Dashboard View */}
                {view === 'dashboard' && (
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '2rem', color: '#111827' }}>
                            Dashboard
                        </h1>

                        {/* Stats Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: '1.5rem',
                            marginBottom: '2rem'
                        }}>
                            {[
                                { label: 'Active Orders', value: stats.active || 0, color: '#3b82f6', bg: '#eff6ff' },
                                { label: 'Completed', value: stats.done || 0, color: '#10b981', bg: '#ecfdf5' },
                                { label: 'Total Earnings', value: formatCurrency(stats.earnings), color: '#f59e0b', bg: '#fffbeb' },
                                { label: 'Total Orders', value: stats.total || 0, color: '#6b7280', bg: '#f9fafb' },
                            ].map((stat, idx) => (
                                <div key={idx} style={{
                                    backgroundColor: '#fff',
                                    borderRadius: '16px',
                                    padding: '1.5rem',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                        {stat.label}
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: stat.color }}>
                                        {stat.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Active Deliveries and Nearby Orders removed from Dashboard tab */}
                    </div>
                )}

                {/* Deliveries View */}
                {view === 'deliveries' && (
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '2rem', color: '#111827' }}>
                            Active Deliveries
                        </h1>
                        {deliveries.length === 0 ? (
                            <div style={{
                                backgroundColor: '#fff',
                                borderRadius: '12px',
                                padding: '3rem',
                                textAlign: 'center',
                                border: '1px solid #e5e7eb'
                            }}>
                                <Package size={48} style={{ color: '#9ca3af', margin: '0 auto 1rem' }} />
                                <p style={{ color: '#6b7280' }}>No active deliveries</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {deliveries.map(delivery => (
                                    <div key={delivery.id} style={{
                                        backgroundColor: '#fff',
                                        borderRadius: '12px',
                                        padding: '1.5rem',
                                        border: '1px solid #e5e7eb',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                    <span style={{
                                                        fontSize: '0.875rem',
                                                        fontWeight: 700,
                                                        backgroundColor: '#dbeafe',
                                                        color: '#1e40af',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '20px'
                                                    }}>
                                                        #{delivery.tracking_number}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.875rem',
                                                        fontWeight: 600,
                                                        color: '#6b7280'
                                                    }}>
                                                        {delivery.distance}
                                                    </span>
                                                </div>
                                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                    {delivery.customer_name}
                                                </h3>
                                                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                                    {delivery.customer_address}
                                                </p>
                                                <p style={{ color: '#059669', fontSize: '0.875rem', fontWeight: 600 }}>
                                                    ETA: {delivery.eta}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                {delivery.status === 'confirmed' && (
                                                    <button
                                                        onClick={() => handleStatusChange(delivery.id, 'in_progress')}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            backgroundColor: '#f59e0b',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            fontSize: '0.875rem'
                                                        }}
                                                    >
                                                        Start Delivery
                                                    </button>
                                                )}
                                                {delivery.status === 'in_progress' && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setFocusedDeliveryId(delivery.id);
                                                                setShowMap(true);
                                                            }}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                backgroundColor: '#3b82f6',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                fontSize: '0.875rem'
                                                            }}
                                                        >
                                                            Location
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusChange(delivery.id, 'delivered')}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                backgroundColor: '#10b981',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                fontSize: '0.875rem'
                                                            }}
                                                        >
                                                            Mark Delivered
                                                        </button>
                                                    </>
                                                )}        </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {nearbyOrders.length > 0 && (
                            <div style={{ marginTop: '3rem' }}>
                                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '2rem', color: '#111827' }}>
                                    Nearby Orders
                                </h1>
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {[...nearbyOrders].sort((a, b) => a.distance_value - b.distance_value).map(order => (
                                        <div key={order.id} style={{
                                            backgroundColor: '#fff',
                                            borderRadius: '12px',
                                            padding: '1.5rem',
                                            border: '1px solid #e5e7eb',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                        <span style={{
                                                            fontSize: '0.875rem',
                                                            fontWeight: 700,
                                                            backgroundColor: '#fef3c7',
                                                            color: '#b45309',
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '20px'
                                                        }}>
                                                            #{order.tracking_number}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.875rem',
                                                            fontWeight: 600,
                                                            color: '#6b7280'
                                                        }}>
                                                            {order.distance} • ~{order.eta}
                                                        </span>
                                                    </div>
                                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                        {order.customer_name}
                                                    </h3>
                                                    <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                                                        {order.customer_address}
                                                    </p>

                                                    {order.sale?.items && (
                                                        <div style={{
                                                            backgroundColor: '#f9fafb',
                                                            padding: '0.75rem',
                                                            borderRadius: '8px',
                                                            marginBottom: '1rem'
                                                        }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                                                Order Items ({order.sale.items.length})
                                                            </div>
                                                            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#4b5563' }}>
                                                                {order.sale.items.map((item, idx) => (
                                                                    <li key={idx}>
                                                                        {item.quantity}x {item.product?.name}
                                                                        {item.product_variant_id && item.variants ? ` (${[item.variants.size, item.variants.color, item.variants.weight].filter(Boolean).join('/')})` : ''}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
                                                    <div style={{
                                                        fontSize: '1.25rem',
                                                        fontWeight: 800,
                                                        color: '#111827'
                                                    }}>
                                                        {formatCurrency(order.sale?.total_amount)}
                                                    </div>
                                                    <button
                                                        onClick={() => handleSelfAssign(order.id)}
                                                        disabled={assigningOrder === order.id}
                                                        style={{
                                                            padding: '0.75rem 1.5rem',
                                                            backgroundColor: '#111827',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontWeight: 600,
                                                            cursor: assigningOrder === order.id ? 'not-allowed' : 'pointer',
                                                            opacity: assigningOrder === order.id ? 0.7 : 1,
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                    >
                                                        {assigningOrder === order.id ? 'Accepting...' : 'Accept Order'}
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

                {/* Ratings View */}
                {view === 'ratings' && (
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '2rem', color: '#111827' }}>
                            Ratings & Reviews
                        </h1>
                        <RatingStatsCard />
                        <div style={{ marginTop: '2rem' }}>
                            <RatingNotificationsPanel />
                        </div>
                    </div>
                )}
            </div>

            {/* Map Modal */}
            {showMap && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 2000,
                    backgroundColor: '#fff'
                }}>
                    <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 2001 }}>
                        <button
                            onClick={() => setShowMap(false)}
                            style={{
                                background: '#111827',
                                color: '#fff',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}
                        >
                            ✕ Close Map
                        </button>
                    </div>

                    {/* Map Legend */}
                    <div style={{
                        position: 'absolute',
                        bottom: 30,
                        right: 20,
                        zIndex: 2001,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Rider (You)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>Customer</span>
                        </div>
                    </div>
                    <MapContainer
                        center={riderPosition ? [riderPosition.lat, riderPosition.lng] : [7.0707, 125.6080]}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={true}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        {riderPosition && (
                            <Marker position={[riderPosition.lat, riderPosition.lng]} icon={createRiderIcon(riderPosition.heading)}>
                                <Popup>You are here</Popup>
                            </Marker>
                        )}

                        {[...deliveries, ...nearbyOrders]
                            .filter(d => focusedDeliveryId ? d.id === focusedDeliveryId : true)
                            .map(d => {
                                const routeKey = `route-${d.id}`;
                                const roadRoute = roadRoutes[routeKey];
                                if (!d.customer_latitude || !d.customer_longitude || !riderPosition) return null;

                                const positions = roadRoute ? roadRoute.coordinates : [
                                    [riderPosition.lat, riderPosition.lng],
                                    [d.customer_latitude, d.customer_longitude]
                                ];
                                return (
                                    <React.Fragment key={routeKey}>
                                        <Polyline
                                            positions={positions}
                                            color={roadRoute ? "#10b981" : "#3b82f6"}
                                            weight={3}
                                            opacity={0.8}
                                        />
                                        <Marker
                                            position={[d.customer_latitude, d.customer_longitude]}
                                            icon={customerIcon}
                                        >
                                            <Popup>
                                                <div>
                                                    <strong>Order #{d.tracking_number || d.order_id}</strong><br />
                                                    {d.customer_address}<br />
                                                    <small>Distance: {d.distance}</small><br />
                                                    <small>ETA: {d.eta}</small>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    </React.Fragment>
                                );
                            })}
                    </MapContainer>
                </div>
            )}

            {/* Proof of Delivery Modal */}
            {showProofModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 3000
                }}>
                    <div style={{
                        backgroundColor: '#fff', borderRadius: '12px', padding: '2rem',
                        width: '90%', maxWidth: '400px'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            Delivery Proof
                        </h3>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                            Please provide a photo as proof of delivery to mark this order as delivered.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            {proofPreview ? (
                                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                    <img
                                        src={proofPreview}
                                        alt="Proof Preview"
                                        style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'contain', backgroundColor: '#f3f4f6' }}
                                    />
                                    <button
                                        onClick={() => { setProofFile(null); setProofPreview(null); }}
                                        style={{
                                            position: 'absolute', top: 8, right: 8, background: '#ef4444', color: '#fff',
                                            border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                        }}
                                    >✕</button>
                                </div>
                            ) : (
                                <label style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    border: '2px dashed #d1d5db', borderRadius: '8px', padding: '2rem 1rem', cursor: 'pointer',
                                    backgroundColor: '#f9fafb', color: '#6b7280', transition: 'all 0.2s'
                                }}>
                                    <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Tap to capture or upload photo</span>
                                    <input type="file" accept="image/*" capture="environment" onChange={handleProofFileChange} style={{ display: 'none' }} />
                                </label>
                            )}

                            {proofError && (
                                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>
                                    {proofError}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => { setShowProofModal(false); setSelectedDeliveryToProof(null); setProofFile(null); setProofPreview(null); setProofError(''); }}
                                disabled={isSubmittingProof}
                                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#111827', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitProof}
                                disabled={isSubmittingProof}
                                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', opacity: isSubmittingProof ? 0.7 : 1 }}
                            >
                                {isSubmittingProof ? 'Sending...' : 'Submit Proof'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Decline Modal */}
            {showDeclineModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3000
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '2rem',
                        width: '90%',
                        maxWidth: '400px'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                            Decline Order
                        </h3>
                        <textarea
                            value={declineNote}
                            onChange={(e) => setDeclineNote(e.target.value)}
                            placeholder="Please provide a reason for declining..."
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                resize: 'vertical',
                                fontSize: '0.875rem'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                            <button
                                onClick={() => {
                                    setShowDeclineModal(false);
                                    setDeclineNote('');
                                    setDecliningOrder(null);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    backgroundColor: '#f3f4f6',
                                    color: '#111827',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDecline}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    backgroundColor: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
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
