import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RatingStars from '@/components/ui/RatingStars';
import { ThumbsUp, MessageSquare, Filter, CheckCircle, Star } from 'lucide-react';

const ProductReviewList = ({ productId, variantId, productVariants }) => {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');
  const [helpfulVotes, setHelpfulVotes] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(variantId || 'all');

  useEffect(() => {
    fetchReviews();
  }, [productId, selectedVariant, sortBy]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const url = selectedVariant && selectedVariant !== 'all'
        ? `/api/products/${productId}/reviews?variant=${selectedVariant}&sort=${sortBy}`
        : `/api/products/${productId}/reviews?sort=${sortBy}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        setReviews(data.data.reviews?.data || []);
        setSummary(data.data.summary);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHelpful = async (reviewId, isHelpful) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hrms_token')}`,
        },
        body: JSON.stringify({ is_helpful: isHelpful }),
      });

      if (response.ok) {
        const data = await response.json();
        setHelpfulVotes(prev => ({
          ...prev,
          [reviewId]: data.data.helpful_count
        }));
      }
    } catch (error) {
      console.error('Error marking helpful:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderRatingBreakdown = () => {
    if (!summary) return null;

    const total = summary.total_reviews;
    const percentages = {};
    
    for (let i = 5; i >= 1; i--) {
      const count = summary.rating_breakdown[i] || 0;
      percentages[i] = total > 0 ? (count / total) * 100 : 0;
    }

    return (
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map(rating => (
          <div key={rating} className="flex items-center gap-2">
            <span className="text-sm w-3">{rating}</span>
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-yellow-400 h-2 rounded-full"
                style={{ width: `${percentages[rating]}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 w-8 text-right">
              {summary.rating_breakdown[rating] || 0}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sort Options */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reviews</h3>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="recent">Most Recent</option>
            <option value="helpful">Most Helpful</option>
            <option value="rating_high">Highest Rating</option>
            <option value="rating_low">Lowest Rating</option>
          </select>
        </div>
      </div>

      {/* Variant Filter */}
      {productVariants && productVariants.length > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filter by variant:</span>
          <Select value={selectedVariant} onValueChange={setSelectedVariant}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select variant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="base">Base Product Only</SelectItem>
              {productVariants.map(variant => (
                <SelectItem key={variant.id} value={variant.id.toString()}>
                  {variant.size_value?.label || ''} 
                  {variant.color_value?.label ? ` - ${variant.color_value.label}` : ''}
                  {variant.weight_value?.label ? ` - ${variant.weight_value.label}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {(!reviews || reviews.length === 0) ? (
          <Card>
            <CardContent className="p-6 text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No reviews yet. Be the first to review this product!</p>
            </CardContent>
          </Card>
        ) : (
          (reviews || []).map(review => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    {/* Customer Avatar */}
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-semibold text-sm">
                        {review.customer?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">
                        {review.customer?.name || 'Anonymous Customer'} on {formatDate(review.created_at)}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <RatingStars rating={review.rating} size="sm" />
                        {review.is_verified_purchase && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified Purchase
                          </Badge>
                        )}
                        {review.product_variant && (
                          <Badge variant="outline" className="text-xs">
                            {review.product_variant.size_value?.label || ''} 
                            {review.product_variant.color_value?.label ? ` - ${review.product_variant.color_value.label}` : ''}
                            {review.product_variant.weight_value?.label ? ` - ${review.product_variant.weight_value.label}` : ''}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-semibold text-gray-900">
                        {review.product_variant ? 
                          `${review.product_variant.size_value?.label || ''}${review.product_variant.color_value?.label ? ` ${review.product_variant.color_value.label}` : ''}${review.product_variant.weight_value?.label ? ` ${review.product_variant.weight_value.label}` : ''} variant` : 
                          'Product default'
                        }
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Review Content */}
                {review.review_text && (
                  <p className="text-gray-700 mb-4 leading-relaxed">
                    {review.review_text}
                  </p>
                )}

                {/* Review Images */}
                {review.images && review.images.length > 0 && (
                  <div className="flex gap-2 mb-4">
                    {review.images.map((image, index) => (
                      <img
                        key={index}
                        src={`/storage/${image}`}
                        alt={`Review image ${index + 1}`}
                        className="w-20 h-20 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}

                {/* Admin Response */}
                {review.admin_response && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      <strong>Response:</strong> {review.admin_response}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleHelpful(review.id, true)}
                    className="flex items-center gap-1"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Helpful ({helpfulVotes[review.id] || review.helpful_count || 0})
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ProductReviewList;
