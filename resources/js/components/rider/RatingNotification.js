import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MessageSquare, X, ExternalLink } from 'lucide-react';

export default function RatingNotification({ notification, onMarkAsRead, onViewDelivery }) {
    const isRatingNotification = notification.data.type === 'feedback';
    
    if (!isRatingNotification) {
        return null;
    }

    const rating = notification.data.rating || 0;
    const comment = notification.data.comment || '';
    const deliveryId = notification.data.delivery_id;

    const getRatingColor = (rating) => {
        if (rating >= 4.5) return 'text-green-600';
        if (rating >= 3.5) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getRatingBgColor = (rating) => {
        if (rating >= 4.5) return 'bg-green-50 border-green-200';
        if (rating >= 3.5) return 'bg-yellow-50 border-yellow-200';
        return 'bg-red-50 border-red-200';
    };

    return (
        <Card className={`mb-2 ${getRatingBgColor(rating)} ${!notification.read_at ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                <span className="font-semibold text-sm">New Rating!</span>
                            </div>
                            {!notification.read_at && (
                                <Badge variant="secondary" className="text-xs">
                                    New
                                </Badge>
                            )}
                        </div>

                        {/* Rating Display */}
                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                        key={star}
                                        className={`w-4 h-4 ${
                                            star <= rating
                                                ? 'text-yellow-500 fill-yellow-500'
                                                : 'text-gray-300'
                                        }`}
                                    />
                                ))}
                                <span className={`font-bold text-lg ml-1 ${getRatingColor(rating)}`}>
                                    {rating}/5
                                </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                                Delivery #{deliveryId}
                            </Badge>
                        </div>

                        {/* Comment */}
                        {comment && (
                            <div className="mb-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <MessageSquare className="w-3 h-3 text-gray-500" />
                                    <span className="text-xs font-medium text-gray-600">Customer Feedback:</span>
                                </div>
                                <p className="text-sm text-gray-700 italic bg-white p-2 rounded border">
                                    "{comment}"
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onViewDelivery(deliveryId)}
                                className="text-xs"
                            >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View Delivery
                            </Button>
                            {!notification.read_at && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onMarkAsRead(notification.id)}
                                    className="text-xs"
                                >
                                    Mark as Read
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Close button */}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onMarkAsRead(notification.id)}
                        className="h-6 w-6 p-0"
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>

                {/* Timestamp */}
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                    {new Date(notification.created_at).toLocaleString()}
                </div>
            </CardContent>
        </Card>
    );
}
