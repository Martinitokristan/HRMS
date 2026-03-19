import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ProductReviewList from '@/components/ui/ProductReviewList';
import ProductReviewForm from '@/components/ui/ProductReviewForm';

export default function ProductReviewsPage() {
    const params = useParams();
    const productId = params.id;
    const navigate = useNavigate();
    const { user } = useAuth();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [canReview, setCanReview] = useState(false);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);
    const [hash, setHash] = useState('');
    const [selectedVariant, setSelectedVariant] = useState(null);

    useEffect(() => {
        // Parse URL to get hash and query params
        const [hash, queryString] = window.location.hash.split('?');
        
        // Check if hash contains #write to show review form
        if (hash === '#write') {
            setShowReviewForm(true);
        }
        
        // Parse variant from query string
        if (queryString) {
            const urlParams = new URLSearchParams(queryString);
            const variantId = urlParams.get('variant');
            if (variantId) {
                setSelectedVariant(variantId);
            }
        }
        
        fetchProduct();
        if (user) {
            checkReviewEligibility();
        }
    }, [productId, user]);

    const fetchProduct = async () => {
        if (!productId) {
            console.error('No productId provided');
            setLoading(false);
            return;
        }
        
        try {
            const response = await fetch(`/api/products/${productId}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.status === 'success') {
                setProduct(data.data);
                
                // If we have a selected variant, find its details
                if (selectedVariant && data.data.product_variants) {
                    const variant = data.data.product_variants.find(v => v.id == selectedVariant);
                    if (variant) {
                        // Store variant info for display
                        setProduct(prev => ({
                            ...prev,
                            selectedVariantInfo: variant
                        }));
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            // Show error message to user
            alert('Failed to load product. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const checkReviewEligibility = async () => {
        if (!user || !productId) return;
        
        try {
            const response = await fetch(`/api/customers/${user.id}/can-review/${productId}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            setCanReview(data.can_review);
        } catch (error) {
            console.error('Error checking review eligibility:', error);
            setCanReview(false);
        }
    };

    const handleReviewSubmitted = (review) => {
        setReviewSubmitted(true);
        setShowReviewForm(false);
        // Refresh the reviews list
        window.location.reload();
    };

    const handleBackToProduct = () => {
        navigate('/shop');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="p-6 text-center">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Not Found</h2>
                        <p className="text-gray-600 mb-4">The product you're looking for doesn't exist.</p>
                        <Button onClick={handleBackToProduct}>Back to Shop</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-6">
                    <Button variant="ghost" onClick={handleBackToProduct} className="mb-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Shop
                    </Button>
                    
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                            {product.image_path && (
                                <img 
                                    src={`/storage/${product.image_path}`} 
                                    alt={product.name}
                                    className="w-20 h-20 object-cover rounded-lg"
                                />
                            )}
                            <div className="flex-1">
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
                                    {product.selectedVariantInfo && (
                                        <p className="text-sm text-orange-600 font-medium">
                                            Reviewing variant: {product.selectedVariantInfo.size_value?.label || ''} 
                                            {product.selectedVariantInfo.color_value?.label || ''} 
                                            {product.selectedVariantInfo.weight_value?.label || ''}
                                        </p>
                                    )}
                                    <p className="text-sm text-gray-600">See what customers are saying about this product</p>
                                </div>
                                <p className="text-gray-600 mb-4">{product.description}</p>
                                
                                {/* Write Review Button */}
                                {user && (
                                    <div className="flex items-center gap-4">
                                        {canReview ? (
                                            <Button onClick={() => setShowReviewForm(true)}>
                                                <Star className="w-4 h-4 mr-2" />
                                                Write a Review
                                            </Button>
                                        ) : (
                                            <Badge variant="secondary" className="text-sm">
                                                You can only review products you've purchased and received
                                            </Badge>
                                        )}
                                    </div>
                                )}
                                
                                {!user && (
                                    <div className="text-sm text-gray-500">
                                        <a href="/login" className="text-orange-500 hover:underline">Log in</a> to write a review
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Review Form */}
                {showReviewForm && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>
                                Write Your Review
                                {product.selectedVariantInfo && (
                                    <span className="text-sm font-normal text-gray-600 block">
                                        for {product.selectedVariantInfo.size_value?.label || ''} 
                                        {product.selectedVariantInfo.color_value?.label || ''} 
                                        {product.selectedVariantInfo.weight_value?.label || ''} variant
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProductReviewForm
                                productId={productId}
                                productVariantId={selectedVariant}
                                onReviewSubmitted={handleReviewSubmitted}
                                onCancel={() => setShowReviewForm(false)}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Success Message */}
                {reviewSubmitted && (
                    <Card className="mb-6 border-green-200 bg-green-50">
                        <CardContent className="p-4">
                            <p className="text-green-800 font-medium">✅ Thank you! Your review has been submitted successfully.</p>
                        </CardContent>
                    </Card>
                )}

                {/* Reviews List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            Customer Reviews
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ProductReviewList 
                            productId={productId} 
                            variantId={selectedVariant}
                            productVariants={product.product_variants || []}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
