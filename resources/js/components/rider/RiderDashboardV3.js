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

// Add custom CSS for markers
const markerStyles = `
    .rider-marker {
        background: #ef4444;
        border: 3px solid white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .customer-marker {
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = markerStyles;
    document.head.appendChild(styleSheet);
}

// Custom icons
const riderIcon = L.divIcon({
    className: 'rider-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

const customerIcon = L.divIcon({
    className: 'customer-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

export default function RiderDashboardV3() {
    const { user, logout } = useAuth();
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
    const [riderPosition, setRiderPosition] = useState([7.0707, 125.608]);
    const [showNotifications, setShowNotifications] = useState(false);
    
    // State for order management
    const [assigningOrder, setAssigningOrder] = useState(null);
    const [decliningOrder, setDecliningOrder] = useState(null);
    const [declineNote, setDeclineNote] = useState('');
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [uploadingProof, setUploadingProof] = useState(null);
    
    // Map and routing state
    const [roadRoutes, setRoadRoutes] = useState({});
    const fileInputRef = useRef(null);
    const mapRef = useRef(null);
    
    // Refs for preventing memory leaks
    const isMountedRef = useRef(true);
    const routeCacheRef = useRef(new Map());

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
    const fetchData = useCallback(async () => {
        if (!isMountedRef.current) return;
        
        try {
            const response = await axios.get('/riders/me/dashboard');
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
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            if (isMountedRef.current) {
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
        fetchData();
        fetchNotifications();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData, fetchNotifications]);

    // Get rider location
    useEffect(() => {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setRiderPosition([latitude, longitude]);
                
                // Broadcast location to WebSocket
                if (window.riderWs && window.riderWs.readyState === WebSocket.OPEN) {
                    window.riderWs.send(JSON.stringify({
                        type: 'location',
                        latitude,
                        longitude,
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
                        riderPosition[0], riderPosition[1],
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
            await fetchData();
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
            await fetchData();
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
            if (isMountedRef.current) {
                const updated = deliveries.map(d => 
                    d.id === deliveryId ? { ...d, status: newStatus } : d
                );
                setDeliveries(updated);
                if (newStatus === 'delivered') {
                    setUploadingProof(deliveryId);
                    setTimeout(() => fileInputRef.current?.click(), 100);
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
                const updated = deliveries.filter(d => d.id !== deliveryId);
                setDeliveries(updated);
                setStats(prev => ({ 
                    ...prev, 
                    active: Math.max(0, prev.active - 1), 
                    done: prev.done + 1 
                }));
            }
        } catch (error) {
            console.error('Failed to upload proof:', error);
        } finally {
            if (isMountedRef.current) {
                setUploadingProof(null);
            }
        }
    }, [deliveries]);

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

                {/* Map Button */}
                {sidebarOpen && (
                    <div style={{ padding: '1rem 1.5rem', marginTop: 'auto' }}>
                        <button
                            onClick={() => setShowMap(true)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.875rem',
                                backgroundColor: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                        >
                            <MapPin size={20} />
                            <span>Show Map</span>
                        </button>
                    </div>
                )}

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
                padding: '2rem'
            }}>
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

                        {/* Active Deliveries */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>
                                Active Deliveries
                            </h2>
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
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Nearby Orders */}
                        {nearbyOrders && nearbyOrders.length > 0 && (
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>
                                    Nearby Orders
                                </h2>
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {nearbyOrders.map(order => (
                                        <div key={order.id} style={{
                                            backgroundColor: '#fff',
                                            borderRadius: '12px',
                                            padding: '1.5rem',
                                            border: '2px solid #fbbf24',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                        <span style={{ 
                                                            fontSize: '0.875rem', 
                                                            fontWeight: 700, 
                                                            backgroundColor: '#fef3c7', 
                                                            color: '#92400e', 
                                                            padding: '0.25rem 0.75rem', 
                                                            borderRadius: '20px' 
                                                        }}>
                                                            #{order.tracking_number}
                                                        </span>
                                                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                            {order.distance}
                                                        </span>
                                                    </div>
                                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                        {order.customer_name}
                                                    </h3>
                                                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                                        {order.customer_address}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleSelfAssign(order.id)}
                                                    disabled={assigningOrder === order.id}
                                                    style={{
                                                        padding: '0.75rem 1.5rem',
                                                        backgroundColor: '#f59e0b',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        fontSize: '0.875rem',
                                                        opacity: assigningOrder === order.id ? 0.7 : 1
                                                    }}
                                                >
                                                    {assigningOrder === order.id ? 'Assigning...' : 'Accept'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
                    <MapContainer 
                        center={riderPosition} 
                        zoom={13} 
                        style={{ height: '100%', width: '100%' }} 
                        zoomControl={true}
                    >
                        <TileLayer 
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <Marker position={riderPosition} icon={riderIcon}>
                            <Popup>You are here</Popup>
                        </Marker>
                        
                        {[...deliveries, ...nearbyOrders].map(d => {
                            const routeKey = `route-${d.id}`;
                            const roadRoute = roadRoutes[routeKey];
                            if (!d.customer_latitude || !d.customer_longitude) return null;
                            
                            const positions = roadRoute ? roadRoute.coordinates : [
                                riderPosition,
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
                                                <strong>Order #{d.tracking_number || d.order_id}</strong><br/>
                                                {d.customer_address}<br/>
                                                <small>Distance: {d.distance}</small><br/>
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

            {/* Hidden file input for photo upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (e.target.files[0] && uploadingProof) {
                        handlePhotoUpload(uploadingProof, e.target.files[0]);
                    }
                }}
            />

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
        </div>
    );
}
