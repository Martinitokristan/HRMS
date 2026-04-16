import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { sileo } from 'sileo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
    MapPin, 
    Clock, 
    Package, 
    Truck, 
    Phone, 
    Star, 
    CheckCircle,
    Navigation,
    DollarSign,
    TrendingUp,
    Users
} from 'lucide-react';
import api from '../../lib/api';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';

export default function RiderDashboard() {
    const { user } = useAuth();
    const { refreshTrigger } = useSilentRefresh('rider_dashboard');
    const [dashboard, setDashboard] = useState(null);
    const [activeDelivery, setActiveDelivery] = useState(null);
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [locationLoading, setLocationLoading] = useState(false);

    useEffect(() => {
        fetchDashboard();
        fetchActiveDelivery();
        
        // Update location every 30 seconds
        const locationInterval = setInterval(() => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(updateLocation);
            }
        }, 30000);
        
        // Refresh dashboard every 60 seconds
        const dashboardInterval = setInterval(() => {
            fetchDashboard();
            fetchActiveDelivery();
        }, 60000);
        
        return () => {
            clearInterval(locationInterval);
            clearInterval(dashboardInterval);
        };
    }, [refreshTrigger]);

    const fetchDashboard = async () => {
        try {
            const response = await api.get('/riders/me/dashboard');
            setDashboard(response.data.data !== undefined ? response.data.data : response.data);
        } catch (error) {
            sileo.error({ title: 'Failed to fetch dashboard data' });
        } finally {
            setLoading(false);
        }
    };

    const fetchActiveDelivery = async () => {
        try {
            const response = await api.get('/deliveries/active');
            setActiveDelivery(response.data.data !== undefined ? response.data.data : response.data);
        } catch (error) {
            // No active delivery is fine
            setActiveDelivery(null);
        }
    };

    const updateLocation = async (position) => {
        if (!activeDelivery) return;
        
        setLocationLoading(true);
        try {
            await api.post(`/deliveries/${activeDelivery.id}/location`, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            });
            setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });
        } catch (error) {
            console.error('Failed to update location:', error);
        } finally {
            setLocationLoading(false);
        }
    };

    const toggleStatus = async () => {
        try {
            const response = await api.post('/riders/me/toggle-status');
            setDashboard(prev => ({
                ...prev,
                availability: response.data.data?.availability || response.data.availability
            }));
            const availability = response.data.data?.availability || response.data.availability;
            sileo.success({ title: `You are now ${availability === 'online' ? 'Online' : 'Offline'}` });
        } catch (error) {
            sileo.error({ title: 'Failed to update status' });
        }
    };

    const acceptDelivery = async (deliveryId) => {
        try {
            await api.post(`/deliveries/${deliveryId}/self-assign`);
            sileo.success({ title: 'Delivery accepted successfully' });
            fetchActiveDelivery();
            fetchDashboard();
        } catch (error) {
            sileo.error({ title: 'Failed to accept delivery' });
        }
    };

    const updateDeliveryStatus = async (status) => {
        if (!activeDelivery) return;
        
        try {
            await api.post(`/deliveries/${activeDelivery.id}/status`, { status });
            sileo.success({ title: `Delivery status updated to ${status}` });
            fetchActiveDelivery();
            fetchDashboard();
        } catch (error) {
            sileo.error({ title: 'Failed to update delivery status' });
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            available: 'bg-green-100 text-green-800',
            busy: 'bg-yellow-100 text-yellow-800',
            offline: 'bg-gray-100 text-gray-800',
            on_delivery: 'bg-blue-100 text-blue-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getDeliveryStatusColor = (status) => {
        const colors = {
            assigned: 'bg-blue-100 text-blue-800',
            picked_up: 'bg-purple-100 text-purple-800',
            in_progress: 'bg-orange-100 text-orange-800',
            delivered: 'bg-green-100 text-green-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(amount || 0);
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Rider Dashboard</h1>
                <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(dashboard?.availability)}>
                        {dashboard?.availability}
                    </Badge>
                    <Button onClick={toggleStatus}>
                        Toggle Status
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {dashboard && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Today's Deliveries</p>
                                    <p className="text-2xl font-bold">{dashboard.today_deliveries}</p>
                                </div>
                                <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                                    <p className="text-2xl font-bold">{formatCurrency(dashboard.total_earnings)}</p>
                                </div>
                                <DollarSign className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Avg Rating</p>
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                        <span className="text-2xl font-bold">{dashboard.avg_rating || 0}</span>
                                    </div>
                                </div>
                                <Star className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">On-Time Rate</p>
                                    <p className="text-2xl font-bold">{dashboard.on_time_rate || 0}%</p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Active Delivery */}
            {activeDelivery ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="w-5 h-5" />
                            Active Delivery
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium">Order #{activeDelivery.sale?.id}</div>
                                <div className="text-sm text-muted-foreground">
                                    Customer: {activeDelivery.sale?.customer?.name}
                                </div>
                            </div>
                            <Badge className={getDeliveryStatusColor(activeDelivery.status)}>
                                {activeDelivery.status}
                            </Badge>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4" />
                                <span>{activeDelivery.sale?.address}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4" />
                                <span>{activeDelivery.sale?.customer?.phone}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4" />
                                <span>Assigned: {formatTime(activeDelivery.assigned_at)}</span>
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <div className="text-sm font-medium mb-2">Order Items</div>
                            <div className="space-y-1">
                                {activeDelivery.sale?.items?.map((item) => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                        <span>{item.product?.name} x {item.quantity}</span>
                                        <span>{formatCurrency(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                                <span>Total</span>
                                <span>{formatCurrency(activeDelivery.sale?.total_amount)}</span>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex gap-2">
                            {activeDelivery.status === 'assigned' && (
                                <Button onClick={() => updateDeliveryStatus('picked_up')}>
                                    Mark as Picked Up
                                </Button>
                            )}
                            {activeDelivery.status === 'picked_up' && (
                                <Button onClick={() => updateDeliveryStatus('in_progress')}>
                                    Start Delivery
                                </Button>
                            )}
                            {activeDelivery.status === 'in_progress' && (
                                <Button onClick={() => updateDeliveryStatus('delivered')}>
                                    Mark as Delivered
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => window.open(`tel:${activeDelivery.sale?.customer?.phone}`)}>
                                <Phone className="w-4 h-4 mr-2" />
                                Call Customer
                            </Button>
                        </div>

                        {locationLoading && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Navigation className="w-4 h-4 animate-pulse" />
                                Updating location...
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Active Deliveries</h3>
                        <p className="text-muted-foreground mb-4">
                            You're all caught up! New deliveries will appear here.
                        </p>
                        <Button onClick={() => window.location.href = '/rider/deliveries'}>
                            View Available Deliveries
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Recent Activity */}
            {dashboard?.recent_deliveries && dashboard.recent_deliveries.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Deliveries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {dashboard.recent_deliveries.map((delivery) => (
                                <div key={delivery.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                                    <div>
                                        <div className="font-medium">Order #{delivery.sale?.id}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {delivery.sale?.customer?.name} • {formatTime(delivery.delivered_at)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={getDeliveryStatusColor(delivery.status)}>
                                            {delivery.status}
                                        </Badge>
                                        {delivery.rating && (
                                            <div className="flex items-center gap-1">
                                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                                <span className="text-sm">{delivery.rating}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
