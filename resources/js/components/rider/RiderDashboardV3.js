import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import RiderSettings from './RiderSettings';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const RiderDashboardV3 = () => {
    const { user, logout } = useAuth();
    const [view, setView] = useState('dashboard');
    const [showMap, setShowMap] = useState(false);
    const [riderPosition, setRiderPosition] = useState([7.0707, 125.6080]);
    const [stats, setStats] = useState({ active: 0, done: 0, total: 0, earnings: 0 });
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [uploadingProof, setUploadingProof] = useState(null);
    const fileInputRef = useRef(null);
    const mapRef = useRef(null);

    // GPS Watch
    useEffect(() => {
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setRiderPosition([pos.coords.latitude, pos.coords.longitude]),
            (err) => console.warn(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/riders/me/dashboard');
                const { stats: dashStats, my_jobs } = response.data.data;
                setStats({
                    active: dashStats.active || 0,
                    done: dashStats.done || 0,
                    total: dashStats.total || 0,
                    earnings: dashStats.collected || 0
                });
                setDeliveries(Array.isArray(my_jobs) ? my_jobs : []);
                
                const notifRes = await axios.get('/riders/me/notifications');
                setNotifications(notifRes.data.data);
                setUnreadCount(notifRes.data.unread_count);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkNotificationsRead = async () => {
        try {
            await axios.post('/riders/me/notifications/read');
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark notifications read:', error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(amount || 0);
    };

    const handleStatusChange = async (deliveryId, newStatus) => {
        try {
            await axios.put(`/deliveries/${deliveryId}/status`, { status: newStatus });
            const updated = deliveries.map(d => 
                d.id === deliveryId ? { ...d, status: newStatus } : d
            );
            setDeliveries(updated);
            
            if (newStatus === 'delivered') {
                setUploadingProof(deliveryId);
                setTimeout(() => fileInputRef.current?.click(), 100);
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const handlePhotoUpload = async (deliveryId, file) => {
        const formData = new FormData();
        formData.append('photo', file);
        try {
            await axios.post(`/deliveries/${deliveryId}/upload-proof`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const updated = deliveries.filter(d => d.id !== deliveryId);
            setDeliveries(updated);
            setStats(prev => ({ 
                ...prev, 
                active: Math.max(0, prev.active - 1), 
                done: prev.done + 1 
            }));
        } catch (error) {
            console.error('Failed to upload proof:', error);
        } finally {
            setUploadingProof(null);
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;
    
    if (view === 'settings') {
        return <RiderSettings onBack={() => setView('dashboard')} />;
    }

    const getPhotoUrl = () => {
        if (user?.photo) {
            return user.photo.startsWith('http') ? user.photo : `/storage/${user.photo}`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Rider')}&background=111827&color=fff&size=48`;
    };

    return (
        <main style={{ minHeight: '100vh', backgroundColor: '#fff', color: '#111827', fontFamily: "'Inter', sans-serif" }}>
            {showMap && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, backgroundColor: '#fff' }}>
                    <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10001 }}>
                        <button 
                            className="btn" 
                            style={{ background: '#111827', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 700, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                            onClick={() => setShowMap(false)}
                        >
                            ✕ Close map
                        </button>
                    </div>
                    <MapContainer center={riderPosition} zoom={15} style={{ height: '100%', width: '100%' }} ref={mapRef}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={riderPosition}><Popup>You are here</Popup></Marker>
                        {deliveries.map(d => (
                            d.customer_latitude && (
                                <Marker key={d.id} position={[d.customer_latitude, d.customer_longitude]}>
                                    <Popup>Order #{d.order_id}<br/>{d.customer_address}</Popup>
                                </Marker>
                            )
                        ))}
                    </MapContainer>
                </div>
            )}

            <div style={{ padding: '2rem 1.5rem', maxWidth: '800px', margin: '0 auto' }}>
                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img 
                            src={getPhotoUrl()} 
                            alt="" 
                            onClick={() => setView('settings')}
                            style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover', cursor: 'pointer' }} 
                        />
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>{user?.name || 'Rider'}</h1>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button 
                                    onClick={() => setShowMap(true)}
                                    style={{ 
                                        background: '#fff', color: '#111827', border: '1px solid #e5e7eb', 
                                        fontSize: '0.75rem', padding: '6px 14px', borderRadius: '10px', 
                                        fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                >
                                    📍 SHOW MAP
                                </button>
                                <button 
                                    onClick={() => setView('settings')}
                                    style={{ 
                                        background: '#fff', color: '#111827', border: '1px solid #e5e7eb', 
                                        fontSize: '0.75rem', padding: '6px 14px', borderRadius: '10px', 
                                        fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                >
                                    ⚙️ SETTINGS
                                </button>
                            </div>
                        </div>
                    </div>
                        <nav style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                            <div style={{ position: 'relative' }}>
                                <button
                                    aria-label="Notifications"
                                    style={{ 
                                        background: '#fff', 
                                        color: '#1a1a1a', 
                                        border: '1px solid #e5e5e5',
                                        padding: '0.6rem',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.25rem'
                                    }}
                                    onClick={() => {
                                        setShowNotifications(!showNotifications);
                                        if (!showNotifications) handleMarkNotificationsRead();
                                    }}
                                >
                                    🔔
                                    {unreadCount > 0 && (
                                        <span style={{ 
                                            position: 'absolute', top: -4, right: -4, 
                                            background: '#ef4444', color: '#fff', 
                                            fontSize: '0.7rem', padding: '2px 6px', 
                                            borderRadius: '10px', fontWeight: 800,
                                            border: '2px solid #fff' 
                                        }}>
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>
                                
                                {showNotifications && (
                                    <div style={{ 
                                        position: 'absolute', top: '120%', right: 0, 
                                        width: '320px', backgroundColor: '#fff', 
                                        borderRadius: '20px', border: '1px solid #f0f0f0', 
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1000,
                                        maxHeight: '400px', overflowY: 'auto'
                                    }}>
                                        <div style={{ padding: '1rem', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700 }}>Notifications</span>
                                            <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>✕</button>
                                        </div>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                                                No notifications yet
                                            </div>
                                        ) : (
                                            notifications.map(notif => (
                                                <div key={notif.id} style={{ 
                                                    padding: '1rem', borderBottom: '1px solid #f9fafb', 
                                                    backgroundColor: notif.read_at ? '#fff' : '#f0f7ff',
                                                    transition: 'background-color 0.2s ease'
                                                }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{notif.data.title}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#444' }}>{notif.data.message}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '6px' }}>
                                                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                aria-label="Sign Out"
                                style={{ 
                                    background: '#fff', 
                                    color: '#ef4444', 
                                    border: '1px solid #fee2e2',
                                    padding: '0.6rem 1rem',
                                    borderRadius: '12px',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={logout}
                            >
                                <span>🚪</span> Sign Out
                            </button>
                        </nav>
                    </header>

                    {/* Stats Grid */}
                    <section aria-label="Daily Statistics" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
                        {[
                            { label: 'Active', value: stats.active || 0, color: '#6366f1', bg: '#eef2ff' },
                            { label: 'Earnings', value: formatCurrency(stats.earnings), color: '#059669', bg: '#ecfdf5' },
                            { label: 'Done', value: stats.done || 0, color: '#d97706', bg: '#fffbeb' },
                            { label: 'Total', value: stats.total || 0, color: '#4b5563', bg: '#f9fafb' },
                        ].map((stat, idx) => (
                            <div key={idx} style={{
                                backgroundColor: '#fff',
                                borderRadius: 20, padding: '1.25rem', 
                                border: '1px solid #f0f0f0',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                            </div>
                        ))}
                    </section>

                    {/* Deliveries */}
                    <section aria-label="Active Deliveries">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Active Deliveries</h2>
                            {deliveries.length > 0 && <span style={{ fontSize: '0.875rem', color: '#666', backgroundColor: '#f0f0f0', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>{deliveries.length} tasks</span>}
                        </div>

                        {(!deliveries || deliveries.length === 0) ? (
                            <div style={{
                                backgroundColor: '#fff', borderRadius: 24, padding: '4rem 2rem', textAlign: 'center',
                                border: '1px solid #f0f0f0', color: '#666'
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: '#1a1a1a', fontWeight: 700 }}>All clear!</h3>
                                <p style={{ margin: 0, fontSize: '0.925rem' }}>No active deliveries at the moment.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {(deliveries || []).map(delivery => (
                                    <div key={delivery.id} style={{
                                        backgroundColor: '#fff',
                                        borderRadius: 24, padding: '1.5rem', 
                                        border: '1px solid #f0f0f0',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                                        transition: 'transform 0.2s ease'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.25rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#f3f4f6', color: '#374151', padding: '4px 10px', borderRadius: 20 }}>
                                                        #{delivery.order_id}
                                                    </span>
                                                    <span style={{ 
                                                        fontSize: '0.75rem', fontWeight: 700, 
                                                        backgroundColor: (delivery.status === 'pending' || delivery.status === 'assigned') ? '#fff7ed' : '#f0fdf4', 
                                                        color: (delivery.status === 'pending' || delivery.status === 'assigned') ? '#c2410c' : '#15803d', 
                                                        padding: '4px 10px', borderRadius: 20,
                                                        textTransform: 'capitalize'
                                                    }}>
                                                        {delivery.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>{delivery.customer_name}</h3>
                                                <p style={{ color: '#666', fontSize: '0.9rem', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span aria-hidden="true">📍</span> {delivery.customer_address}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            {(delivery.status === 'pending' || delivery.status === 'assigned') && (
                                                <button
                                                    style={{ 
                                                        flex: 1, background: '#1a1a1a', color: '#fff', border: 'none', 
                                                        padding: '0.875rem', borderRadius: 14, fontWeight: 700, cursor: 'pointer',
                                                        fontSize: '0.925rem'
                                                    }}
                                                    onClick={() => handleStatusChange(delivery.id, 'in_progress')}
                                                >
                                                    Accept Delivery
                                                </button>
                                            )}
                                            {(delivery.status === 'in_progress' || delivery.status === 'accepted') && (
                                                <button
                                                    style={{ 
                                                        flex: 1, background: '#6366f1', color: '#fff', border: 'none', 
                                                        padding: '0.875rem', borderRadius: 14, fontWeight: 700, cursor: 'pointer',
                                                        fontSize: '0.925rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                                                    }}
                                                    onClick={() => handleStatusChange(delivery.id, 'delivered')}
                                                >
                                                    Mark as Delivered
                                                </button>
                                            )}
                                            <button 
                                                aria-label="View Details"
                                                style={{ width: '48px', height: '48px', background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', cursor: 'pointer' }}
                                            >
                                                📄
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
                <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                aria-hidden="true"
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (e.target.files[0] && uploadingProof) {
                        handlePhotoUpload(uploadingProof, e.target.files[0]);
                    }
                }}
            />
        </main>
    );
};

export default RiderDashboardV3;
