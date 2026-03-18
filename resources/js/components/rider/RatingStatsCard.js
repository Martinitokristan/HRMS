import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, TrendingUp, Users, MessageSquare } from 'lucide-react';

export default function RatingStatsCard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRatingStats();
    }, []);

    const fetchRatingStats = async () => {
        try {
            const response = await axios.get('/riders/me/rating-stats');
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch rating stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!stats || stats.total_ratings === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <Star className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No ratings yet</p>
                    <p className="text-sm text-gray-400">Complete deliveries to receive customer ratings</p>
                </CardContent>
            </Card>
        );
    }

    const getRatingColor = (rating) => {
        if (rating >= 4.5) return 'text-green-600';
        if (rating >= 3.5) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getRatingBgColor = (rating) => {
        if (rating >= 4.5) return 'bg-green-100';
        if (rating >= 3.5) return 'bg-yellow-100';
        return 'bg-red-100';
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Your Ratings
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Average Rating Display */}
                <div className="text-center">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getRatingBgColor(stats.average_rating)}`}>
                        <span className={`text-2xl font-bold ${getRatingColor(stats.average_rating)}`}>
                            {stats.average_rating}
                        </span>
                        <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                        star <= Math.round(stats.average_rating)
                                            ? 'text-yellow-500 fill-yellow-500'
                                            : 'text-gray-300'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                        Average from {stats.total_ratings} rating{stats.total_ratings !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* Rating Distribution */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <TrendingUp className="w-4 h-4" />
                        Rating Breakdown
                    </div>
                    {[5, 4, 3, 2, 1].map((rating) => (
                        <div key={rating} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 w-12">
                                <span className="text-sm font-medium">{rating}</span>
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            </div>
                            <div className="flex-1">
                                <Progress 
                                    value={stats.rating_percentages[rating] || 0} 
                                    className="h-2"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 w-16 justify-end">
                                <span>{stats.rating_distribution[rating] || 0}</span>
                                <span className="text-xs">({stats.rating_percentages[rating] || 0}%)</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Recent Rating */}
                {stats.recent_rating && (
                    <div className="border-t pt-3">
                        <div className="flex items-center gap-2 text-sm font-medium mb-2">
                            <MessageSquare className="w-4 h-4" />
                            Latest Feedback
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                        key={star}
                                        className={`w-3 h-3 ${
                                            star <= stats.recent_rating
                                                ? 'text-yellow-500 fill-yellow-500'
                                                : 'text-gray-300'
                                        }`}
                                    />
                                ))}
                            </div>
                            <Badge variant="outline" className="text-xs">
                                {stats.recent_date ? new Date(stats.recent_date).toLocaleDateString() : 'Recently'}
                            </Badge>
                        </div>
                        {stats.recent_comment && (
                            <p className="text-sm text-gray-600 italic">
                                "{stats.recent_comment}"
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
