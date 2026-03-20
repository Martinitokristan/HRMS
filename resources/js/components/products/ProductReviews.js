import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Star, ThumbsUp, MessageSquare, User, CheckCircle } from 'lucide-react';
import axios from 'axios';

export default function ProductReviews({ productId }) {
    const { user } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [loading, setLoading] = useState(false);
    const [canReview, setCanReview] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchReviews();
        if (user) {
            checkEligibility();
        }
    }, [productId, user]);

    const fetchReviews = async () => {
        try {
            const response = await axios.get(`/products/${productId}/reviews`);
            setReviews(response.data.data.reviews || []);
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
        }
    };

    const checkEligibility = async () => {
        try {
            const response = await axios.get(`/customers/${user.id}/can-review/${productId}`);
            setCanReview(response.data.data.can_review);
        } catch (error) {
            console.error('Failed to check eligibility:', error);
        }
    };

    const submitReview = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post(`/products/${productId}/reviews`, {
                rating,
                review: review.trim()
            });
            
            toast.success('Review submitted successfully! It will be visible after approval.');
            setRating(0);
            setReview('');
            setCanReview(false);
            fetchReviews();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const markHelpful = async (reviewId) => {
        try {
            await axios.post(`/api/reviews/${reviewId}/helpful`, { is_helpful: true });
            fetchReviews();
            toast.success('Thank you for your feedback!');
        } catch (error) {
            toast.error('Failed to mark as helpful');
        }
    };

    const renderStars = (rating, interactive = false) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-4 h-4 ${
                            star <= (interactive ? hoveredStar || rating : rating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                        } ${interactive ? 'cursor-pointer' : ''}`}
                        onClick={interactive ? () => setRating(star) : undefined}
                        onMouseEnter={interactive ? () => setHoveredStar(star) : undefined}
                        onMouseLeave={interactive ? () => setHoveredStar(0) : undefined}
                    />
                ))}
            </div>
        );
    };

    const renderRatingDistribution = () => {
        if (!stats) return null;
        
        const distribution = stats.rating_distribution || {};
        const total = stats.total_reviews || 0;
        
        return (
            <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                    const count = distribution[star] || 0;
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    
                    return (
                        <div key={star} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 w-16">
                                <span className="text-sm">{star}</span>
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            </div>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-yellow-400 h-2 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            <span className="text-sm text-muted-foreground w-12 text-right">
                                {count}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Rating Summary */}
            {stats && (
                <Card>
                    <CardContent className="p-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="text-center">
                                <div className="text-4xl font-bold mb-2">
                                    {stats.average_rating.toFixed(1)}
                                </div>
                                {renderStars(Math.round(stats.average_rating))}
                                <div className="text-sm text-muted-foreground mt-1">
                                    {stats.total_reviews} review{stats.total_reviews !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-medium mb-3">Rating Distribution</h4>
                                {renderRatingDistribution()}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Write Review */}
            {user && canReview && (
                <Card>
                    <CardHeader>
                        <CardTitle>Write a Review</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Share your experience with this product
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Rating</label>
                            {renderStars(rating, true)}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Your Review</label>
                            <Textarea
                                placeholder="Tell us about your experience with this product..."
                                value={review}
                                onChange={(e) => setReview(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <Button onClick={submitReview} disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit Review'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Reviews List */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Customer Reviews</h3>
                
                {reviews.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h4 className="text-lg font-medium mb-2">No reviews yet</h4>
                            <p className="text-muted-foreground">
                                Be the first to review this product!
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    reviews.map((review) => (
                        <Card key={review.id}>
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-medium">{review.customer?.name}</div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                {renderStars(review.rating)}
                                                <span>•</span>
                                                <span>
                                                    {new Date(review.created_at).toLocaleDateString()}
                                                </span>
                                                {review.status === 'approved' && (
                                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {review.product_variant && (
                                        <Badge variant="secondary">
                                            {review.product_variant.size_value?.label} / 
                                            {review.product_variant.color_value?.label}
                                        </Badge>
                                    )}
                                </div>
                                
                                {review.review && (
                                    <p className="text-sm mb-4">{review.review}</p>
                                )}
                                
                                {review.admin_response && (
                                    <div className="bg-muted p-3 rounded-md mb-4">
                                        <div className="text-sm font-medium mb-1">Seller Response</div>
                                        <p className="text-sm">{review.admin_response}</p>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-4 text-sm">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => markHelpful(review.id)}
                                        className="flex items-center gap-1"
                                    >
                                        <ThumbsUp className="w-3 h-3" />
                                        Helpful ({review.helpful_count || 0})
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
