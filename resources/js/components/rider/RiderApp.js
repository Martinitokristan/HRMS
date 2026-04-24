import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, RefreshCw, MapIcon, Smartphone, Phone, Navigation, CheckCircle2, XCircle, PhilippinePeso, Truck, Package, MapPin, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const riderIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const jobIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function RecenterMap({ pos }) {
    const map = useMap();
    useEffect(() => {
        if (pos) {
            map.flyTo(pos, map.getZoom(), { duration: 1.5 });
        }
    }, [pos]);
    return null;
}

export default function RiderApp() {
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('nearby');
    const [hideMap, setHideMap] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const [riderPos, setRiderPos] = useState([7.0707, 125.6080]); // Default to Davao
    const [hasGeo, setHasGeo] = useState(false);

    // Stats/Data states
    const [stats, setStats] = useState({ total: 0, done: 0, active: 0, failed: 0, quota: 10000, collected: 0 });
    const [nearby, setNearby] = useState([]);
    const [myJobs, setMyJobs] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [refresh, setRefresh] = useState(0);

    // Watch Geolocation
    useEffect(() => {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'error');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setRiderPos([latitude, longitude]);
                setHasGeo(true);
            },
            (err) => {
                console.warn('Geolocation error:', err);
                showToast('Unable to get your location. Using default.', 'warning');
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const triggerRefresh = () => setRefresh(prev => prev + 1);

    const fetchData = async () => {
        try {
            const res = await api.get('/riders/me/dashboard', {
                params: hasGeo ? {
                    latitude: riderPos[0],
                    longitude: riderPos[1]
                } : {}
            });
            const d = res.data;
            setStats(d.stats || { total: 0, done: 0, active: 0, failed: 0, quota: 10000, collected: 0 });
            setNearby(d.nearby || []);
            setMyJobs(d.my_jobs || []);
            setCompleted(d.completed || []);
        } catch (e) {
            showToast('Failed to fetch dashboard data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // refresh every 30s
        return () => clearInterval(interval);
    }, [refresh]);

    // Proximity notification: send rider location for active in_progress jobs every 15s
    useEffect(() => {
        if (!hasGeo || myJobs.length === 0) return;
        const activeJobs = myJobs.filter(j => j.status === 'in_progress');
        if (activeJobs.length === 0) return;

        const sendProximity = () => {
            activeJobs.forEach(job => {
                api.post(`/deliveries/${job.id}/proximity`, {
                    latitude: riderPos[0],
                    longitude: riderPos[1],
                }).then(res => {
                    if (res.data.notified) {
                        showToast(`Customer notified — you're ${Math.round(res.data.distance_km * 1000)}m away!`, 'success');
                    }
                }).catch(() => { });
            });
        };

        sendProximity();
        const interval = setInterval(sendProximity, 15000);
        return () => clearInterval(interval);
    }, [hasGeo, riderPos, myJobs]);

    const handleAction = async (id, status, actionNote) => {
        try {
            if (status === 'assigned') {
                await api.put(`/deliveries/${id}/assign`, { rider_id: user.id });
                setActiveTab('my_jobs');
            } else {
                await api.put(`/deliveries/${id}/status`, { status });
            }
            showToast(actionNote || 'Action successful');
            triggerRefresh();
        } catch (e) {
            showToast('Action failed', 'error');
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen bg-secondary/30"><div className="spinner" /></div>;

    if (user && user.status === 'suspended') {
        return (
            <div className="min-h-screen flex items-center justify-center p-8 bg-secondary/30">
                <Card className="max-w-md w-full p-8 text-center border-destructive/50 shadow-2xl">
                    <div className="text-lg font-black text-foreground mb-6 tracking-tighter">HRMS</div>
                    <div className="mb-4"><XCircle className="h-16 w-16 mx-auto text-destructive" /></div>
                    <h1 className="text-xl font-bold text-foreground mb-3">Account Suspended</h1>
                    <p className="text-muted-foreground leading-relaxed mb-6 max-w-sm mx-auto">
                        Your rider account has been suspended by the management. Please contact support or visit the main office for clarification regarding your account status.
                    </p>
                    <div className="flex flex-col gap-2">
                        <Button variant="outline" onClick={() => navigate('/login')} className="border-destructive/20 hover:bg-destructive/5">
                            Back to Login
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    if (user && (user.status === 'pending' || user.status === 'interview_set')) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8 bg-secondary/30">
                <Card className="max-w-md w-full p-8 text-center border-orange-500/50 shadow-2xl">
                    <div className="text-lg font-black text-foreground mb-6 tracking-tighter">HRMS</div>
                    <div className="mb-4"><Clock className="h-16 w-16 mx-auto text-orange-500" /></div>
                    <h1 className="text-xl font-bold text-foreground mb-3">
                        {user.status === 'interview_set' ? 'Interview Scheduled' : 'Application Pending'}
                    </h1>
                    <p className="text-muted-foreground leading-relaxed mb-6 max-w-sm mx-auto">
                        {user.status === 'interview_set'
                            ? 'Your interview has been scheduled. Please wait for further instructions from the admin.'
                            : 'Your rider application is under review. Please wait for the admin to schedule an interview or approve your account.'}
                    </p>
                    <div className="flex flex-col gap-2">
                        <Button variant="outline" onClick={() => navigate('/login')} className="border-orange-500/20 hover:bg-orange-500/5">
                            Back to Login
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className={`rider-dashboard-v2 ${hideMap ? 'hide-map' : ''}`}>
            {/* Sidebar / List View */}
            <div className="rider-sidebar">
                <div className="p-4 border-b border-border bg-white">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">{user?.name?.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-foreground text-sm truncate">{user?.name}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">Rider ID: RDR-{user?.id?.toString().padStart(4, '0')}</div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-green-500 text-white text-[10px]">Online</Badge>
                            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setHideMap(!hideMap)}>
                                {hideMap ? <><MapIcon className="h-3 w-3 mr-1" /> Show Map</> : <><Smartphone className="h-3 w-3 mr-1" /> Hide Map</>}
                            </Button>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={logout}>
                            <LogOut className="h-3 w-3 mr-1" /> Sign Out
                        </Button>
                    </div>
                </div>

                <div className="dashboard-content-wrapper">
                    <div className="dashboard-inner-container">
                        {/* Stats Header */}
                        <Card className="m-3 p-4 bg-foreground text-white border-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3">TODAY — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</div>
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                <div className="text-center bg-white/10 rounded-xl py-2">
                                    <div className="text-xl font-black">{stats.total}</div>
                                    <div className="text-[10px] text-white/60 font-semibold">Total</div>
                                </div>
                                <div className="text-center bg-green-500/20 rounded-xl py-2">
                                    <div className="text-xl font-black text-green-400">{stats.done}</div>
                                    <div className="text-[10px] text-white/60 font-semibold">Done</div>
                                </div>
                                <div className="text-center bg-orange-500/20 rounded-xl py-2">
                                    <div className="text-xl font-black text-orange-400">{stats.active}</div>
                                    <div className="text-[10px] text-white/60 font-semibold">Active</div>
                                </div>
                                <div className="text-center bg-red-500/20 rounded-xl py-2">
                                    <div className="text-xl font-black text-red-400">{stats.failed}</div>
                                    <div className="text-[10px] text-white/60 font-semibold">Failed</div>
                                </div>
                            </div>

                            <div className="bg-white/10 rounded-xl p-3">
                                <div className="flex justify-between text-xs font-bold mb-2">
                                    <span className="flex items-center gap-1"><PhilippinePeso className="h-3 w-3" /> COD QUOTA</span>
                                    <span>₱{Number(stats.collected).toLocaleString()} / ₱{Number(stats.quota).toLocaleString()}</span>
                                </div>
                                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${Math.min(100, (stats.collected / (stats.quota || 1)) * 100)}%` }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-white/50 mt-1.5">
                                    <span>{Math.round((stats.collected / (stats.quota || 1)) * 100)}% of daily target</span>
                                    <span>₱{Number((stats.quota || 0) - (stats.collected || 0)).toLocaleString()} remaining</span>
                                </div>
                            </div>
                        </Card>

                        {/* Main Tabs */}
                        <div className="flex border-b border-border mx-3">
                            <button className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${activeTab === 'nearby' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveTab('nearby')}>
                                <MapPin className="inline h-3.5 w-3.5 mr-1" /> Nearby
                            </button>
                            <button className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${activeTab === 'my_jobs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveTab('my_jobs')}>
                                <Truck className="inline h-3.5 w-3.5 mr-1" /> My Jobs
                            </button>
                            <button className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${activeTab === 'completed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveTab('completed')}>
                                <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" /> Done
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="tab-content-scroll">
                            {activeTab === 'nearby' && (
                                <div className="p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><MapPin className="h-3 w-3" /> {nearby.length} orders near you</span>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={triggerRefresh}><RefreshCw className="h-3 w-3" /> Refresh</Button>
                                    </div>
                                    {nearby.length === 0 && (
                                        <Card className="text-center py-10 px-6">
                                            <MapPin className="text-3xl mb-2" />
                                            <h3 className="font-bold text-foreground mb-1">No Nearby Orders</h3>
                                            <p className="text-sm text-muted-foreground">We'll notify you when new orders arrive in your current zone.</p>
                                        </Card>
                                    )}
                                    {nearby.map(order => (
                                        <Card key={order.id} className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-foreground">#{order.sale?.order_number}</span>
                                                <Badge variant="secondary" className="text-[10px] font-bold">{order.distance} AWAY</Badge>
                                                <span className="text-sm font-black text-primary">₱{Number(order.sale?.total_amount).toLocaleString()}</span>
                                            </div>
                                            <div className="font-bold text-foreground text-sm mb-0.5">{order.sale?.customer?.name}</div>
                                            <div className="text-xs text-muted-foreground mb-1">{order.address}</div>
                                            <div className="text-[10px] text-muted-foreground mb-3 line-clamp-1">{order.sale?.items?.map(i => `${i.quantity}x ${i.product?.name}`).join(', ')}</div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> {order.distance} — 4 min drive</span>
                                                <Button size="sm" className="h-7 text-xs font-bold" onClick={() => handleAction(order.id, 'assigned', 'Order accepted!')}>ACCEPT →</Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'my_jobs' && (
                                <div className="p-3 space-y-3">
                                    {myJobs.length === 0 && (
                                        <Card className="text-center py-10 px-6">
                                            <Truck className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-30" />
                                            <h3 className="font-bold text-foreground mb-1">No Active Jobs</h3>
                                            <p className="text-sm text-muted-foreground">Ready for more? Check the "Nearby" tab to accept a new delivery.</p>
                                        </Card>
                                    )}
                                    {myJobs.map(order => (
                                        <Card key={order.id} className={`p-4 ${order.status === 'in_progress' ? 'border-primary/50 bg-primary/5' : ''}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-foreground">#{order.sale?.order_number}</span>
                                                <Badge variant="outline" className="text-[10px] capitalize flex items-center gap-1"><Truck className="h-3 w-3" /> {order.status.replace('_', ' ')}</Badge>
                                                <span className="text-sm font-black text-primary">₱{Number(order.sale?.total_amount).toLocaleString()}</span>
                                            </div>
                                            <div className="font-bold text-foreground text-sm mb-0.5">{order.sale?.customer?.name}</div>
                                            <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /> {order.address}</div>
                                            <div className="flex items-center gap-2">
                                                {order.status === 'pending' ? (
                                                    <Button size="sm" className="flex-1 h-8 text-xs font-bold" onClick={() => handleAction(order.id, 'in_progress', 'Delivery started')}>START DELIVERY</Button>
                                                ) : (
                                                    <>
                                                        <Button size="sm" className="flex-1 h-8 text-xs font-bold bg-green-600 hover:bg-green-700" onClick={() => handleAction(order.id, 'delivered', 'Marked as delivered')}><CheckCircle2 className="h-3 w-3 mr-1" /> COMPLETE</Button>
                                                        <Button size="sm" variant="destructive" className="h-8 text-xs font-bold" onClick={() => { if (confirm('Mark as failed?')) handleAction(order.id, 'failed', 'Marked as failed'); }}><XCircle className="h-3 w-3 mr-1" /> FAIL</Button>
                                                    </>
                                                )}
                                                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => window.open(`tel:${order.sale?.customer?.phone || ''}`)}><Phone className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'completed' && (
                                <div className="p-3 space-y-2">
                                    {completed.length === 0 && (
                                        <Card className="text-center py-10 px-6">
                                            <div className="text-3xl mb-2">📝</div>
                                            <h3 className="font-bold text-foreground mb-1">No Recent Activity</h3>
                                            <p className="text-sm text-muted-foreground">Your finished deliveries and failed attempts will show up here.</p>
                                        </Card>
                                    )}
                                    {completed.map(order => (
                                        <Card key={order.id} className="p-3 flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-bold text-foreground">#{order.sale?.order_number}</div>
                                                <div className="text-[10px] font-bold mt-0.5">
                                                    {order.status === 'delivered' ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> DELIVERED</span> : <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" /> FAILED</span>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-foreground">₱{Number(order.sale?.total_amount).toLocaleString()}</div>
                                                <div className="text-[10px] text-muted-foreground">{new Date(order.updated_at).toLocaleDateString().toUpperCase()}</div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div> {/* END inner-container */}
                </div> {/* END content-wrapper */}
            </div>

            {/* Map Area */}
            <div className="rider-map-area">
                <div className="absolute top-0 left-0 right-0 z-10 p-3">
                    <Card className="px-4 py-2.5 flex items-center justify-between bg-white/95 backdrop-blur-sm">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Delivery Map — Davao City Zone</span>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> You</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Nearby</span>
                        </div>
                    </Card>
                </div>

                <div className="map-placeholder">
                    <MapContainer
                        center={riderPos}
                        zoom={16}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                    >
                        <TileLayer
                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            attribution="&copy; Google Maps"
                        />

                        {/* Rider Marker */}
                        <Marker position={riderPos} icon={riderIcon}>
                            <Popup>
                                <div className="font-extrabold">YOU (REAL LOCATION)</div>
                                <div className="text-[11px] text-muted-foreground">{hasGeo ? 'GPS Signal: Strong' : 'Waiting for GPS...'}</div>
                            </Popup>
                        </Marker>

                        {/* Job Markers */}
                        {nearby.map(job => (
                            <Marker
                                key={job.id}
                                position={[job.latitude || riderPos[0], job.longitude || riderPos[1]]}
                                icon={jobIcon}
                                eventHandlers={{
                                    click: () => setSelectedJob(job),
                                }}
                            >
                                <Popup>
                                    <div className="font-black text-green-700 flex items-center gap-1"><Package className="h-3.5 w-3.5" /> NEW ORDER #{job.sale?.order_number}</div>
                                    <div className="text-xs my-1">{job.address}</div>
                                    <div className="text-[11px] font-bold text-orange-500">COD: ₱{Number(job.sale?.total_amount).toLocaleString()}</div>
                                </Popup>
                            </Marker>
                        ))}

                        <RecenterMap pos={riderPos} />
                    </MapContainer>
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-10 p-3 space-y-2">
                    {/* GPS Status Bar */}
                    <Card className="px-4 py-2 flex items-center justify-between bg-white/95 backdrop-blur-sm">
                        <span className="text-[10px] font-medium text-muted-foreground">{hasGeo ? `GPS: ${riderPos[0].toFixed(5)}, ${riderPos[1].toFixed(5)}` : 'SCANNING GPS...'}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold" onClick={() => setRefresh(r => r + 1)}>RE-CENTER</Button>
                    </Card>

                    {/* Selected Job Mini Card (Float) */}
                    {activeTab === 'nearby' && nearby.length > 0 && (
                        <Card className="p-3 bg-white/95 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-foreground text-sm">{nearby[0].sale?.customer?.name}</span>
                                <span className="text-xs text-muted-foreground font-medium">#{nearby[0].sale?.order_number}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">{nearby[0].address}</div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> {nearby[0].distance} — 4 min drive</span>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Navigation className="h-3 w-3" /> Navigate</Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}