import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Star, Bell, BellOff, RefreshCw, Filter } from 'lucide-react';
import RatingNotification from './RatingNotification';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';

export default function RatingNotificationsPanel() {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.RIDER_NOTIFICATIONS);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(notifications.length === 0);
    const [filter, setFilter] = useState('all'); // all, unread, read
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchNotifications(notifications.length > 0);
    }, [refreshTrigger]);

    const fetchNotifications = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await api.get('/riders/me/notifications');
            const allNotifications = response.data.data || [];
            
            // Filter only rating notifications
            const ratingNotifications = allNotifications.filter(notif => 
                notif.data && notif.data.type === 'feedback'
            );
            
            setNotifications(ratingNotifications);
        } catch (error) {
            // Silence background check
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await api.post('/riders/me/notifications/read');
            markStale(STALE_KEYS.RIDER_NOTIFICATIONS);
            // Update local state for immediate feedback
            setNotifications(prev => 
                prev.map(notif => 
                    notif.id === notificationId 
                        ? { ...notif, read_at: new Date().toISOString() }
                        : notif
                )
            );
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.post('/riders/me/notifications/read');
            markStale(STALE_KEYS.RIDER_NOTIFICATIONS);
            setNotifications(prev => 
                prev.map(notif => ({ ...notif, read_at: new Date().toISOString() }))
            );
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications(true);
        setRefreshing(false);
    };

    const handleViewDelivery = (deliveryId) => {
        // Navigate to delivery details or scroll to delivery in dashboard
        const deliveryElement = document.querySelector(`[data-delivery-id="${deliveryId}"]`);
        if (deliveryElement) {
            deliveryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the delivery
            deliveryElement.style.transition = 'all 0.3s ease';
            deliveryElement.style.backgroundColor = '#fef3c7';
            deliveryElement.style.border = '2px solid #f59e0b';
            setTimeout(() => {
                deliveryElement.style.backgroundColor = '';
                deliveryElement.style.border = '';
            }, 3000);
        }
    };

    const filteredNotifications = notifications.filter(notif => {
        if (filter === 'unread') return !notif.read_at;
        if (filter === 'read') return notif.read_at;
        return true;
    });

    const unreadCount = notifications.filter(notif => !notif.read_at).length;

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="space-y-2">
                            <div className="h-16 bg-gray-200 rounded"></div>
                            <div className="h-16 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Star className="w-5 h-5 text-yellow-500" />
                        Rating Notifications
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                                {unreadCount} new
                            </Badge>
                        )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="text-xs"
                        >
                            <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        {unreadCount > 0 && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleMarkAllAsRead}
                                className="text-xs"
                            >
                                <BellOff className="w-3 h-3 mr-1" />
                                Mark All Read
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Filter Tabs */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <div className="flex gap-1">
                        {[
                            { value: 'all', label: 'All', count: notifications.length },
                            { value: 'unread', label: 'Unread', count: unreadCount },
                            { value: 'read', label: 'Read', count: notifications.length - unreadCount }
                        ].map(tab => (
                            <Button
                                key={tab.value}
                                size="sm"
                                variant={filter === tab.value ? "default" : "outline"}
                                onClick={() => setFilter(tab.value)}
                                className="text-xs"
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <Badge variant="secondary" className="ml-1 text-xs">
                                        {tab.count}
                                    </Badge>
                                )}
                            </Button>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Notifications List */}
                {filteredNotifications.length === 0 ? (
                    <div className="text-center py-8">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">
                            {filter === 'unread' ? 'No unread rating notifications' : 
                             filter === 'read' ? 'No read rating notifications' : 
                             'No rating notifications yet'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            Complete deliveries to receive customer ratings
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredNotifications.map(notification => (
                            <RatingNotification
                                key={notification.id}
                                notification={notification}
                                onMarkAsRead={handleMarkAsRead}
                                onViewDelivery={handleViewDelivery}
                            />
                        ))}
                    </div>
                )}

                {/* Summary */}
                {notifications.length > 0 && (
                    <div className="pt-3 border-t">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Total rating notifications: {notifications.length}</span>
                            <span>Average rating: {
                                notifications.length > 0 
                                    ? (notifications.reduce((sum, notif) => sum + (notif.data.rating || 0), 0) / notifications.length).toFixed(1)
                                    : 'N/A'
                            }/5</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
