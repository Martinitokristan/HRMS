import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RatingStars from '@/components/ui/RatingStars';
import { ThumbsUp, MessageSquare, Filter, CheckCircle, Star } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';
import api, { silentApi } from '../../lib/api';

const ProductReviewList = ({ productId, variantId, productVariants }) => {
  const { refreshTrigger } = useSilentRefresh(STALE_KEYS.PRODUCT_REVIEWS);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(reviews?.length === 0);
  const [filterBy, setFilterBy] = useState('recent');
  const [helpfulVotes, setHelpfulVotes] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(variantId || 'all');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const perPage = 10;

  useEffect(() => {
    fetchReviews(reviews?.length > 0);
  }, [productId, selectedVariant, filterBy, refreshTrigger, currentPage]);

  const fetchReviews = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let url = `/products/${productId}/reviews?filter=${filterBy}&page=${currentPage}&per_page=${perPage}`;
      if (selectedVariant && selectedVariant !== 'all') url += `&variant=${selectedVariant}`;

      const response = await silentApi.get(url);
      const data = response.data;

      const responseData = data.data !== undefined ? data.data : data;

      if (responseData) {
        setReviews(responseData.reviews?.data || []);
        setTotalCount(responseData.reviews?.total || 0);
        setSummary(responseData.summary);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleHelpful = async (reviewId, isHelpful) => {
    try {
      // NOTE: hrms_token sessionStorage is removed as we use httpOnly cookies
      const response = await api.post(`/reviews/${reviewId}/helpful`, { is_helpful: isHelpful });

      const responseData = response.data.data !== undefined ? response.data.data : response.data;

      if (responseData) {
        markStale(STALE_KEYS.PRODUCT_REVIEWS);
        setHelpfulVotes(prev => ({
          ...prev,
          [reviewId]: responseData.helpful_count || 0
        }));
      }
    } catch (error) {
      console.error('Error marking helpful:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0 space-y-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white p-8 rounded-[2rem] border border-gray-100 space-y-4">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                </div>
              </div>
              <div className="h-4 bg-gray-100 rounded w-full"></div>
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-10 mb-20">
      {/* Rating Summary Section */}
      {summary && (
        <div className="mb-12 bg-white rounded-[3rem] p-8 lg:p-12 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Side: Average Rating */}
            <div className="lg:col-span-4 text-center lg:border-r border-gray-100 lg:pr-12">
              <div className="text-7xl font-black text-gray-900 mb-2 leading-none">
                {Number(summary.average_rating || 0).toFixed(1)}
              </div>
              <div className="flex justify-center mb-4">
                <RatingStars rating={summary.average_rating} size="lg" />
              </div>
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest">
                Based on {summary.total_reviews || 0} reviews
              </p>
            </div>

            {/* Right Side: Distribution Bars */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.rating_breakdown?.[star] || 0;
                const totalRev = Number(summary.total_reviews) || 0;
                const percentage = totalRev > 0 ? (count / totalRev) * 100 : 0;
                return (
                  <div
                    key={star}
                    className={`flex items-center gap-4 cursor-pointer group/bar p-1 rounded-xl transition-colors
                        ${(filterBy === `rating_${star}` || (star === 5 && filterBy === 'rating_high') || (star === 1 && filterBy === 'rating_low')) ? 'bg-orange-50/50' : 'hover:bg-gray-50'}
                      `}
                    onClick={() => {
                      const ratingKey = star === 5 ? 'rating_high' :
                        star === 1 ? 'rating_low' :
                          `rating_${star}`;
                      setFilterBy(filterBy === ratingKey ? 'recent' : ratingKey);
                      setCurrentPage(1);
                    }}
                  >
                    <div className="flex items-center gap-2 w-16">
                      <span className="text-xs font-black text-gray-600">{star}</span>
                      <Star className={`w-3 h-3 ${count > 0 ? 'text-orange-400 fill-orange-400' : 'text-gray-300'}`} />
                    </div>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="w-12 text-right">
                      <span className="text-xs font-black text-gray-400 group-hover/bar:text-orange-500 transition-colors">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters Strip */}
      <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Variant</span>
            <Select value={selectedVariant} onValueChange={(val) => { setSelectedVariant(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-44 h-11 rounded-xl bg-gray-50 border-gray-100 text-xs font-bold ring-offset-white focus:ring-1 focus:ring-orange-200">
                <SelectValue placeholder="All Variants" />
              </SelectTrigger>
              <SelectContent className="z-[100000]">
                <SelectItem value="all">All Reviews</SelectItem>
                {(productVariants || []).map(variant => (
                  <SelectItem key={variant.id} value={variant.id.toString()}>
                    {variant.size_value?.label || ''}
                    {variant.color_value?.label ? ` ${variant.color_value.label}` : ''}
                    {variant.weight_value?.label ? ` ${variant.weight_value.label}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Filter By</span>
            <Select value={filterBy} onValueChange={(val) => { setFilterBy(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-48 h-11 rounded-xl bg-gray-50 border-gray-100 text-xs font-bold ring-offset-white focus:ring-1 focus:ring-orange-200">
                <SelectValue placeholder="Most Recent" />
              </SelectTrigger>
              <SelectContent className="z-[100000]">
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="helpful">Most Helpful</SelectItem>
                <SelectItem value="rating_high">Highest Rating</SelectItem>
                <SelectItem value="rating_low">Lowest Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Counter */}
        <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-5 py-2 rounded-full border border-gray-100">
          {totalCount} total results
        </div>
      </div>

      {/* Reviews List */}
      <div className="grid grid-cols-1 gap-8">
        {(!reviews || reviews.length === 0) ? (
          <div className="py-32 text-center bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100">
            <MessageSquare className="w-16 h-16 text-gray-200 mx-auto mb-6" />
            <h4 className="text-xl font-black text-gray-400 uppercase tracking-[0.2em]">Silence from the community</h4>
            <p className="text-sm text-gray-400 mt-2">
              {filterBy.startsWith('rating_')
                ? `No reviews with this star rating found.`
                : "Be the first to share your thoughts on this product."}
            </p>
            {filterBy.startsWith('rating_') && (
              <Button
                variant="ghost"
                className="mt-6 font-black text-xs uppercase tracking-widest"
                onClick={() => setFilterBy('recent')}
              >
                Clear Filter
              </Button>
            )}
          </div>
        ) : (
          reviews.map(review => (
            <div key={review.id} className="group bg-white p-8 lg:p-10 rounded-[2.5rem] border border-gray-100 hover:border-orange-100 hover:shadow-2xl hover:shadow-orange-500/5 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div className="flex items-start gap-5">
                  {/* User Avatar Initials */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-black shadow-lg
                    ${['bg-orange-500', 'bg-blue-500', 'bg-indigo-500', 'bg-rose-500', 'bg-emerald-500'][review.id % 5]}
                  `}>
                    {review.customer?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-lg font-black text-gray-900 tracking-tight">{review.customer?.name || 'Community Member'}</h4>
                      {review.is_verified_purchase && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-gray-400">
                      <span>{formatDate(review.created_at)}</span>
                      {review.product_variant && (
                        <span className="flex items-center gap-1.5 opacity-60">
                          <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                          {review.product_variant.size_value?.label || ''}
                          {review.product_variant.color_value?.label ? ` · ${review.product_variant.color_value.label}` : ''}
                          {review.product_variant.weight_value?.label ? ` · ${review.product_variant.weight_value.label}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stars in Top Right */}
                <div className="flex items-center gap-0.5 scale-125 md:pt-2">
                  <RatingStars rating={review.rating} size="sm" />
                </div>
              </div>

              {/* Review Content */}
              <div className="pl-0 md:pl-[4.5rem]">
                {review.review_title && (
                  <h5 className="text-xl font-black text-gray-900 mb-3 tracking-tight">{review.review_title}</h5>
                )}
                <p className="text-lg text-gray-600 leading-relaxed font-medium mb-8 max-w-5xl">
                  {review.review_text}
                </p>

                {/* Thumbnails */}
                {Array.isArray(review.images) && review.images.length > 0 && (
                  <div className="flex flex-wrap gap-4 mb-8">
                    {review.images.map((image, idx) => (
                      <div key={idx} className="group/img relative w-24 h-24 rounded-2xl overflow-hidden border border-gray-100 hover:border-orange-200 transition-colors cursor-zoom-in">
                        <img
                          src={`/storage/${image}`}
                          className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Helpful Action */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-black uppercase tracking-widest">Helpful?</span>
                  <button
                    onClick={() => handleHelpful(review.id, true)}
                    className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 hover:border-orange-100 hover:bg-orange-50 text-gray-600 hover:text-orange-600 py-2 px-4 rounded-xl transition-all font-black text-[11px] active:scale-95 group/btn"
                  >
                    <span className="group-hover/btn:scale-125 transition-transform">👍</span>
                    {helpfulVotes[review.id] !== undefined ? helpfulVotes[review.id] : (review.helpful_count || 0)}
                  </button>
                </div>

                {/* Admin Clarification */}
                {review.admin_response && (
                  <div className="mt-8 p-6 bg-blue-50/50 border border-blue-100 rounded-3xl">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2">Team Clarification</div>
                    <p className="text-sm text-blue-800 leading-relaxed italic">
                      “{review.admin_response}”
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalCount > perPage && (
        <div className="flex items-center justify-center gap-3 py-10 border-t border-gray-100">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="w-12 h-12 rounded-full border border-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            ←
          </button>

          <div className="flex items-center gap-2">
            {[...Array(Math.ceil(totalCount / perPage) || 0)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-12 h-12 rounded-full text-xs font-black transition-all
                  ${currentPage === i + 1
                    ? 'bg-gray-900 text-white shadow-xl shadow-gray-200'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            disabled={currentPage === Math.ceil(totalCount / perPage)}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="w-12 h-12 rounded-full border border-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductReviewList;
