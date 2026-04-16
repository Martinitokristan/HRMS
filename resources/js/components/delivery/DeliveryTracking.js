import React, { useState, useEffect } from 'react';
import { sileo } from 'sileo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MapPin, Clock, CheckCircle, Package, Truck, Phone, Star } from 'lucide-react';
import api from '../../lib/api';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';

export default function DeliveryTracking({ deliveryId }) {
    const { refreshTrigger } = useSilentRefresh('admin_deliveries');
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useState(null);

    useEffect(() => {
        fetchDelivery();
        
        // Update location every 30 seconds if delivery is in progress
        const interval = setInterval(() => {
            if (delivery?.status === 'in_progress') {
                fetchDelivery();
            }
        }, 30000);
        
        return () => clearInterval(interval);
    }, [deliveryId, refreshTrigger]);

    const fetchDelivery = async () => {
        try {
            const response = await api.get(`/deliveries/${deliveryId}`);
            setDelivery(response.data.data);
            if (response.data.data.rider_latitude && response.data.data.rider_longitude) {
                setLocation({
                    lat: response.data.data.rider_latitude,
                    lng: response.data.data.rider_longitude
                });
            }
        } catch (error) {
            sileo.error('Failed to fetch delivery details');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800',
            assigned: 'bg-blue-100 text-blue-800',
            picked_up: 'bg-purple-100 text-purple-800',
            in_progress: 'bg-orange-100 text-orange-800',
            delivered: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getStatusIcon = (status) => {
        const icons = {
            pending: Clock,
            assigned: Package,
            picked_up: Truck,
            in_progress: Truck,
            delivered: CheckCircle,
            cancelled: Package
        };
        return icons[status] || Package;
    };

    const getStatusText = (status) => {
        const texts = {
            pending: 'Order Placed',
            assigned: 'Rider Assigned',
            picked_up: 'Picked Up',
            in_progress: 'On the Way',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        };
        return texts[status] || status;
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return 'Not yet';
        return new Date(timestamp).toLocaleString();
    };

    const getEstimatedDelivery = () => {
        if (!delivery) return null;
        const pickupTime = delivery.pickup_at || delivery.assigned_at;
        if (!pickupTime) return null;
        
        const estimated = new Date(pickupTime);
        estimated.setMinutes(estimated.getMinutes() + 30); // 30 minutes delivery time
        return estimated;
    };

    const renderTimeline = () => {
        if (!delivery) return null;
        
        const timeline = [
            { status: 'pending', time: delivery.created_at, completed: true },
            { status: 'assigned', time: delivery.assigned_at, completed: !!delivery.assigned_at },
            { status: 'picked_up', time: delivery.pickup_at, completed: !!delivery.pickup_at },
            { status: 'in_progress', time: delivery.pickup_at, completed: delivery.status === 'in_progress' || delivery.status === 'delivered' },
            { status: 'delivered', time: delivery.delivered_at, completed: delivery.status === 'delivered' }
        ];
        
        return (
            <div className="space-y-4">
                {timeline.map((item, index) => {
                    const Icon = getStatusIcon(item.status);
                    const isLast = index === timeline.length - 1;
                    
                    return (
                        <div key={item.status} className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    item.completed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                }`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                {!isLast && (
                                    <div className={`w-0.5 h-8 ${
                                        item.completed ? 'bg-primary' : 'bg-muted'
                                    }`} />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="font-medium">{getStatusText(item.status)}</div>
                                <div className="text-sm text-muted-foreground">
                                    {formatTime(item.time)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!delivery) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Delivery not found</h3>
                    <p className="text-muted-foreground">
                        The delivery information could not be found.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Delivery Tracking</h1>
                <Badge className={getStatusColor(delivery.status)}>
                    {getStatusText(delivery.status)}
                </Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Delivery Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Order Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-sm text-muted-foreground">Order ID</div>
                                <div className="font-medium">#{delivery.sale?.id}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Delivery Address</div>
                                <div className="font-medium">{delivery.sale?.address}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Customer</div>
                                <div className="font-medium">{delivery.sale?.customer?.name}</div>
                                <div className="text-sm text-muted-foreground">
                                    {delivery.sale?.customer?.phone}
                                </div>
                            </div>
                            {delivery.notes && (
                                <div>
                                    <div className="text-sm text-muted-foreground">Delivery Notes</div>
                                    <div className="font-medium">{delivery.notes}</div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Delivery Timeline</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderTimeline()}
                        </CardContent>
                    </Card>

                    {/* Rider Info */}
                    {delivery.rider && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Delivery Rider</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                                        <Truck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="font-medium">{delivery.rider.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {delivery.rider.phone}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline">
                                        <Phone className="w-3 h-3 mr-1" />
                                        Call Rider
                                    </Button>
                                    <Button size="sm" variant="outline">
                                        <MapPin className="w-3 h-3 mr-1" />
                                        Track Location
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Estimated Delivery */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Estimated Delivery</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {getEstimatedDelivery() ? (
                                <div className="text-center">
                                    <Clock className="w-8 h-8 mx-auto mb-2 text-primary" />
                                    <div className="font-medium">
                                        {getEstimatedDelivery().toLocaleString()}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        ~30 minutes from pickup
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <Clock className="w-8 h-8 mx-auto mb-2" />
                                    <div>Calculating...</div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Order Items */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Items</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {delivery.sale?.items?.map((item) => (
                                <div key={item.id} className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                        <Package className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{item.product?.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Qty: {item.quantity} • ₱{item.price.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Separator />
                            <div className="flex justify-between font-medium">
                                <span>Total</span>
                                <span>₱{delivery.sale?.total_amount?.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button className="w-full" variant="outline">
                                <Phone className="w-4 h-4 mr-2" />
                                Contact Support
                            </Button>
                            <Button className="w-full" variant="outline">
                                <Package className="w-4 h-4 mr-2" />
                                Report Issue
                            </Button>
                            {delivery.status === 'delivered' && (
                                <Button className="w-full">
                                    <Star className="w-4 h-4 mr-2" />
                                    Rate Delivery
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
