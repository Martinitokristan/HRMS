import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Star, MessageSquare, ThumbsUp, CheckCircle, XCircle, Clock, Filter, Search } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function Reviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedReview, setSelectedReview] = useState(null);
    const [responseText, setResponseText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        fetchReviews();
    }, [activeTab, statusFilter, searchTerm]);

    const fetchReviews = async () => {
        setLoading(true);
        
        // Debug: Check authentication token
        const token = localStorage.getItem('hrms_token');
        console.log('🔍 [Reviews] Token found:', token ? 'YES' : 'NO');
        console.log('🔍 [Reviews] Token length:', token ? token.length : 0);
        console.log('🔍 [Reviews] Token starts with:', token ? token.substring(0, 20) + '...' : 'NONE');
        
        try {
            const params = new URLSearchParams();
            if (activeTab !== 'all') params.append('status', activeTab);
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (searchTerm) params.append('search', searchTerm);

            const response = await axios.get(`/api/reviews?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('🔍 [Reviews] API Response:', response.status);
            console.log('🔍 [Reviews] Response data type:', typeof response.data);
            console.log('🔍 [Reviews] Response data:', response.data);
            
            // Parse response.data if it's a string
            let data = response.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                    console.log('🔍 [Reviews] Parsed JSON data:', data);
                } catch (e) {
                    console.error('🔍 [Reviews] Failed to parse JSON:', e);
                    setReviews([]);
                    return;
                }
            }
            
            // Handle the response structure properly
            if (data && data.data && data.data.data) {
                setReviews(data.data.data);
                console.log('🔍 [Reviews] Reviews loaded:', data.data.data.length);
            } else {
                setReviews([]);
                console.log('🔍 [Reviews] No reviews found in response');
            }
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
            if (error.response && error.response.status === 401) {
                toast.error('Please login as admin to access reviews');
                console.log('🔍 [Reviews] 401 Unauthorized - Admin login required');
            } else {
                toast.error('Failed to load reviews');
                console.log('🔍 [Reviews] Error:', error.message);
            }
            setReviews([]);
        } finally {
            setLoading(false);
        }
    };

    const updateReviewStatus = async (reviewId, status) => {
        try {
            const token = localStorage.getItem('hrms_token');
            await axios.put(`/api/reviews/${reviewId}/status`, { status }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            toast.success(`Review ${status} successfully`);
            fetchReviews();
            setSelectedReview(null);
        } catch (error) {
            console.error('Failed to update review status:', error);
            toast.error('Failed to update review status');
        }
    };

    const respondToReview = async (reviewId) => {
        if (!responseText.trim()) {
            toast.error('Please enter a response');
            return;
        }

        try {
            const token = localStorage.getItem('hrms_token');
            await axios.post(`/api/reviews/${reviewId}/respond`, {
                response: responseText
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            toast.success('Response sent successfully');
            setResponseText('');
            fetchReviews();
            setSelectedReview(null);
        } catch (error) {
            console.error('Failed to respond to review:', error);
            toast.error('Failed to send response');
        }
    };

    const deleteReview = async (reviewId) => {
        if (!confirm('Are you sure you want to delete this review?')) return;

        try {
            const token = localStorage.getItem('hrms_token');
            await axios.delete(`/api/reviews/${reviewId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            toast.success('Review deleted successfully');
            fetchReviews();
            setSelectedReview(null);
        } catch (error) {
            console.error('Failed to delete review:', error);
            toast.error('Failed to delete review');
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            pending: 'secondary',
            approved: 'default',
            rejected: 'destructive'
        };
        const labels = {
            pending: 'Pending',
            approved: 'Approved',
            rejected: 'Rejected'
        };
        return <Badge variant={variants[status]}>{labels[status]}</Badge>;
    };

    const renderStars = (rating) => {
        return Array.from({ length: 5 }, (_, i) => (
            <Star
                key={i}
                className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
            />
        ));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Reviews Management</h1>
                    <p className="text-muted-foreground">Manage customer reviews and feedback</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search reviews..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Reviews Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="all">All Reviews</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="space-y-4">
                    {reviews.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">No reviews found</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {reviews.map((review) => (
                                <Card key={review.id} className="cursor-pointer hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="flex items-center">
                                                        {renderStars(review.rating)}
                                                    </div>
                                                    {getStatusBadge(review.status)}
                                                </div>
                                                <h4 className="font-semibold">{review.product?.name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    By {review.customer?.name} • {new Date(review.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                {review.status === 'pending' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => updateReviewStatus(review.id, 'approved')}
                                                            className="bg-green-600 hover:bg-green-700"
                                                        >
                                                            <CheckCircle className="h-4 w-4 mr-1" />
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => updateReviewStatus(review.id, 'rejected')}
                                                        >
                                                            <XCircle className="h-4 w-4 mr-1" />
                                                            Reject
                                                        </Button>
                                                    </>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSelectedReview(review)}
                                                >
                                                    View Details
                                                </Button>
                                            </div>
                                        </div>

                                        {review.review && (
                                            <p className="text-sm mb-3 line-clamp-2">{review.review}</p>
                                        )}

                                        {review.admin_response && (
                                            <div className="bg-muted p-3 rounded-md">
                                                <p className="text-sm font-semibold text-primary">Admin Response:</p>
                                                <p className="text-sm">{review.admin_response}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Review Details Modal */}
            {selectedReview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Review Details</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedReview(null)}
                                >
                                    ×
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                {renderStars(selectedReview.rating)}
                                {getStatusBadge(selectedReview.status)}
                            </div>

                            <div>
                                <h4 className="font-semibold">{selectedReview.product?.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                    By {selectedReview.customer?.name} • {new Date(selectedReview.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            {selectedReview.review && (
                                <div>
                                    <h5 className="font-semibold mb-2">Review:</h5>
                                    <p className="text-sm">{selectedReview.review}</p>
                                </div>
                            )}

                            {selectedReview.admin_response && (
                                <div>
                                    <h5 className="font-semibold mb-2">Previous Admin Response:</h5>
                                    <p className="text-sm bg-muted p-3 rounded-md">{selectedReview.admin_response}</p>
                                </div>
                            )}

                            {/* Admin Response Form */}
                            <div>
                                <h5 className="font-semibold mb-2">Admin Response:</h5>
                                <Textarea
                                    placeholder="Write your response..."
                                    value={responseText}
                                    onChange={(e) => setResponseText(e.target.value)}
                                    rows={3}
                                />
                                <div className="flex gap-2 mt-2">
                                    <Button
                                        onClick={() => respondToReview(selectedReview.id)}
                                        disabled={!responseText.trim()}
                                    >
                                        Send Response
                                    </Button>
                                    {selectedReview.status === 'pending' && (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => updateReviewStatus(selectedReview.id, 'approved')}
                                                className="border-green-600 text-green-600 hover:bg-green-50"
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => updateReviewStatus(selectedReview.id, 'rejected')}
                                                className="border-red-600 text-red-600 hover:bg-red-50"
                                            >
                                                Reject
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        variant="destructive"
                                        onClick={() => deleteReview(selectedReview.id)}
                                    >
                                        Delete Review
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
