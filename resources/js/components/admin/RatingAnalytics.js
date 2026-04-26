import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import PaginatedTable from '@/components/ui/PaginatedTable';
import { 
    Star, 
    TrendingUp, 
    TrendingDown, 
    Users, 
    Award, 
    AlertTriangle,
    RefreshCw,
    Download,
    Calendar,
    MessageSquare
} from 'lucide-react';

export default function RatingAnalytics() {
    const { refreshTrigger } = useSilentRefresh('admin_reviews');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchAnalytics();
    }, [period, refreshTrigger]);

    const fetchAnalytics = async () => {
        try {
            const response = await api.get(`/reports/rating-analytics?period=${period}`);
            setData(response.data.data);
        } catch (error) {
            console.error('Failed to fetch rating analytics:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAnalytics();
    };

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

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <Star className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No rating data available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Rating Analytics</h1>
                    <p className="text-gray-600">
                        {data.date_range.from} to {data.date_range.to}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Tabs value={period} onValueChange={setPeriod}>
                        <TabsList>
                            <TabsTrigger value="week">Week</TabsTrigger>
                            <TabsTrigger value="month">Month</TabsTrigger>
                            <TabsTrigger value="year">Year</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500" />
                            <span className="text-sm font-medium text-gray-600">Average Rating</span>
                        </div>
                        <div className={`text-3xl font-bold mt-2 ${getRatingColor(data.overall_stats.average_rating)}`}>
                            {data.overall_stats.average_rating}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            From {data.overall_stats.total_ratings} ratings
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500" />
                            <span className="text-sm font-medium text-gray-600">Total Ratings</span>
                        </div>
                        <div className="text-3xl font-bold mt-2">
                            {data.overall_stats.total_ratings}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Customer feedback
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium text-gray-600">Top Performers</span>
                        </div>
                        <div className="text-3xl font-bold mt-2">
                            {data.top_performers.length}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            4.0+ avg, 5+ ratings
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <span className="text-sm font-medium text-gray-600">Needs Attention</span>
                        </div>
                        <div className="text-3xl font-bold mt-2">
                            {data.needs_improvement.length}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Below 3.0 avg
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Rating Distribution */}
            <Card>
                <CardHeader>
                    <CardTitle>Rating Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[5, 4, 3, 2, 1].map(rating => (
                            <div key={rating} className="flex items-center gap-3">
                                <div className="flex items-center gap-1 w-12">
                                    <span className="text-sm font-medium">{rating}</span>
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                </div>
                                <div className="flex-1">
                                    <Progress 
                                        value={data.overall_stats.rating_percentages[rating] || 0} 
                                        className="h-2"
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 w-24">
                                    <span>{data.overall_stats.rating_distribution[rating] || 0}</span>
                                    <span>({data.overall_stats.rating_percentages[rating] || 0}%)</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Tabs for detailed views */}
            <Tabs defaultValue="rankings" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="rankings">Rider Rankings</TabsTrigger>
                    <TabsTrigger value="performers">Top Performers</TabsTrigger>
                    <TabsTrigger value="trends">Rating Trends</TabsTrigger>
                    <TabsTrigger value="feedback">Recent Feedback</TabsTrigger>
                </TabsList>

                <TabsContent value="rankings" className="space-y-4">
                    <PaginatedTable
                        title="All Rider Rankings"
                        apiEndpoint={`/reports/rating-analytics/rankings?period=${period}`}
                        columns={[
                            {
                                key: 'rank',
                                title: 'Rank',
                                render: (value, item, index) => (
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-medium">
                                        {index + 1}
                                    </div>
                                )
                            },
                            {
                                key: 'rider_name',
                                title: 'Rider Name',
                                render: (value, item) => (
                                    <div>
                                        <p className="font-medium">{value}</p>
                                        <p className="text-sm text-gray-500">
                                            {item.total_ratings} ratings
                                        </p>
                                    </div>
                                )
                            },
                            {
                                key: 'average_rating',
                                title: 'Average Rating',
                                render: (value) => (
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                        <span className={`font-bold ${getRatingColor(value)}`}>
                                            {value}
                                        </span>
                                    </div>
                                )
                            },
                            {
                                key: 'positive_rate',
                                title: 'Positive Rate',
                                render: (value) => (
                                    <Badge variant={value >= 80 ? "default" : "secondary"}>
                                        {value}% positive
                                    </Badge>
                                )
                            }
                        ]}
                        defaultPageSize={20}
                        emptyMessage="No rider rankings available"
                    />
                </TabsContent>

                <TabsContent value="performers" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-green-500" />
                                    Top Performers
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {data.top_performers.length > 0 ? (
                                        data.top_performers.map((rider) => (
                                            <div key={rider.rider_id} className={`p-3 border rounded-lg ${getRatingBgColor(rider.average_rating)}`}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">{rider.rider_name}</p>
                                                        <p className="text-sm text-gray-600">
                                                            {rider.total_ratings} ratings
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="flex items-center gap-1">
                                                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                            <span className={`font-bold ${getRatingColor(rider.average_rating)}`}>
                                                                {rider.average_rating}
                                                            </span>
                                                        </div>
                                                        <Badge variant="default" className="text-xs mt-1">
                                                            {rider.positive_rate}% positive
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">No top performers yet</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                    Needs Improvement
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {data.needs_improvement.length > 0 ? (
                                        data.needs_improvement.map((rider) => (
                                            <div key={rider.rider_id} className={`p-3 border rounded-lg ${getRatingBgColor(rider.average_rating)}`}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">{rider.rider_name}</p>
                                                        <p className="text-sm text-gray-600">
                                                            {rider.total_ratings} ratings
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="flex items-center gap-1">
                                                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                            <span className={`font-bold ${getRatingColor(rider.average_rating)}`}>
                                                                {rider.average_rating}
                                                            </span>
                                                        </div>
                                                        <Badge variant="destructive" className="text-xs mt-1">
                                                            {rider.positive_rate}% positive
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">No riders need improvement</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="trends" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rating Trends Over Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {data.rating_trends.map((trend, index) => (
                                    <div key={trend.date} className="flex items-center justify-between p-3 border rounded">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-4 h-4 text-gray-500" />
                                            <span className="text-sm font-medium">{trend.date}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1">
                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                <span className={`font-bold ${getRatingColor(trend.average_rating)}`}>
                                                    {trend.average_rating}
                                                </span>
                                            </div>
                                            <Badge variant="outline">
                                                {trend.count} ratings
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="feedback" className="space-y-4">
                    <PaginatedTable
                        title="Recent Customer Feedback"
                        apiEndpoint={`/reports/rating-analytics/feedback?period=${period}`}
                        columns={[
                            {
                                key: 'rating',
                                title: 'Rating',
                                render: (value, item) => (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1">
                                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                            <span className={`font-bold ${getRatingColor(value)}`}>
                                                {value}/5
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            #{item.tracking_number}
                                        </Badge>
                                    </div>
                                )
                            },
                            {
                                key: 'rated_at',
                                title: 'Date',
                                render: (value) => (
                                    <span className="text-xs text-gray-500">
                                        {new Date(value).toLocaleDateString()}
                                    </span>
                                )
                            },
                            {
                                key: 'customer_name',
                                title: 'Customer → Rider',
                                render: (value, item) => (
                                    <span className="text-sm font-medium text-gray-600">
                                        {value} → {item.rider_name}
                                    </span>
                                )
                            },
                            {
                                key: 'rating_comment',
                                title: 'Comment',
                                render: (value) => (
                                    value ? (
                                        <div className="bg-gray-50 p-2 rounded text-sm italic max-w-xs">
                                            "{value}"
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-sm">No comment</span>
                                    )
                                )
                            }
                        ]}
                        defaultPageSize={20}
                        emptyMessage="No customer feedback available"
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
