import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import VariantSelector from '../shared/VariantSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Percent, ShoppingCart, Minus, Plus, X, MessageSquare, Star, CheckCircle2 } from 'lucide-react';
import { getProductSaleInfo, getVariantSaleInfo } from '../../utils/priceCalculations';
import { useAuth } from '../../context/AuthContext';
import RatingStars from '../ui/RatingStars';
import ProductReviewList from '../ui/ProductReviewList';
import api, { silentApi } from '../../lib/api';

export default function ProductDetailModal({ isOpen, onClose, product, onAddToCart }) {
    const [qty, setQty] = useState(1);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState({ size: '', color: '', weight: '' });
    const [activeGalleryImage, setActiveGalleryImage] = useState(null);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [showReviews, setShowReviews] = useState(false);
    const [canReview, setCanReview] = useState(false);
    const [checkingEligibility, setCheckingEligibility] = useState(false);
    const [productRating, setProductRating] = useState(null);
    const [loadingRating, setLoadingRating] = useState(false);
    const [soldCount, setSoldCount] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (isOpen && product) {
            try {
                setQty(1);
                setSelectedVariant(null);
                setSelectedOptions({ size: '', color: '', weight: '' });
                setActiveGalleryImage(null);
                setForceUpdate(prev => prev + 1);
                setShowReviews(false);

                // Initialize productRating with data from props if available to avoid flicker
                if (product.average_rating !== undefined && product.total_reviews !== undefined) {
                    setProductRating({
                        average_rating: product.average_rating,
                        total_reviews: product.total_reviews
                    });
                }

                // Fetch product rating and sold count in parallel
                fetchProductData();

                // Check review eligibility for logged-in users
                if (user && product.id) {
                    checkReviewEligibility();
                } else {
                    setCanReview(false);
                }
            } catch (error) {
                console.error('Error in modal useEffect:', error);
            }
        }
    }, [isOpen, product, user]);

    const fetchProductData = async () => {
        if (!product?.id) return;

        // If we already have rating data in the product prop, use it immediately
        if (product.average_rating !== undefined && product.total_reviews !== undefined && !productRating) {
            setProductRating({
                average_rating: product.average_rating,
                total_reviews: product.total_reviews
            });
            // We can still fetch metadata in the background if needed
        }

        const hasInitialData = product.average_rating !== undefined && product.total_reviews !== undefined;
            setLoadingRating(!hasInitialData && !productRating); // Only show loading if we don't have data yet
            try {
                // Fetch both rating and sold count in parallel for faster loading
                const [ratingRes, soldRes] = await Promise.all([
                    silentApi.get(`/products/${product.id}/reviews`),
                    silentApi.get(`/products/${product.id}/sold-count`)
                ]);

            // Set rating data
            const ratingData = ratingRes.data;
            if (ratingData.data?.summary) {
                setProductRating(ratingData.data.summary);
            }

            // Set sold count data
            const soldData = soldRes.data;
            if (soldData.status === 'success') {
                setSoldCount(soldData.sold_count || 0);
            }
        } catch (error) {
            console.error('Error fetching product data:', error);
        } finally {
            setLoadingRating(false);
        }
    };

    const checkReviewEligibility = async () => {
        if (!user || !product.id) return;

        setCheckingEligibility(true);
        try {
            const response = await silentApi.get(`/customers/${user.id}/can-review/${product.id}`);
            // Check both data.can_review and data.status for flexibility
            if (response.data.status === 'success' || response.data.can_review !== undefined) {
                setCanReview(response.data.can_review);
            }
        } catch (error) {
            console.error('Error checking review eligibility:', error);
            setCanReview(false);
        } finally {
            setCheckingEligibility(false);
        }
    };

    const handleReviewsClick = () => {
        setShowReviews(true);
    };

    const handleBackToProduct = () => {
        setShowReviews(false);
    };

    if (!product) return null;

    const baseStock = Number(product.available_stock || product.inventory?.current_stock || 0);
    const allVariants = product.product_variants || product.variants || [];

    // Show reviews view
    if (showReviews) {
        return (
            <div className="fixed inset-0 z-[99999] bg-white overflow-y-auto animate-in fade-in slide-in-from-bottom duration-300">
                <div className="w-full px-4 md:px-12 lg:px-20 py-8 md:py-16">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16 pb-8 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-[#FF5A1F]">Customer Voice</div>
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                            <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">Product Reviews</div>
                        </div>
                        <button 
                            onClick={handleBackToProduct}
                            className="bg-[#FF5A1F] text-white text-[10px] font-black uppercase tracking-[0.2em] py-4 px-10 rounded-full hover:bg-orange-600 transition-all active:scale-95 shadow-xl shadow-orange-500/20 flex items-center gap-3"
                        >
                            <span className="text-white/80">←</span> Back to Product
                        </button>
                    </div>

                    {/* Product Summary Banner - Horizontal Split */}
                    <div className="mb-16 p-10 lg:p-12 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm flex flex-col xl:flex-row items-center gap-12">
                        {/* Info */}
                        <div className="flex-1 border-r border-gray-100 pr-12 text-center xl:text-left">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400 mb-3 block">Viewing feedback for</span>
                            <h3 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter leading-tight">{product.name}</h3>
                            <p className="text-base text-gray-500 leading-relaxed max-w-lg">
                                Authentic feedback from verified buyers who have used this product. Read their experiences below.
                            </p>
                        </div>
                        
                        {/* Summary Score */}
                        <div className="px-12 flex flex-col items-center">
                            <div className="text-7xl font-black text-[#FF5A1F] tracking-tighter mb-2 leading-none">
                                {Number(productRating?.average_rating || 0).toFixed(1)}
                            </div>
                            <div className="flex items-center gap-0.5 mb-2 scale-110">
                                <RatingStars rating={productRating?.average_rating || 0} size="sm" />
                            </div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                {productRating?.total_reviews || 0} reviews
                            </div>
                        </div>

                        {/* Breakdown */}
                        <div className="flex-1 w-full xl:w-80 space-y-2 border-l border-gray-100 pl-12">
                            {[5, 4, 3, 2, 1].map(rating => {
                                const count = productRating?.rating_breakdown?.[rating] || 0;
                                const total = productRating?.total_reviews || 1;
                                const percentage = (count / total) * 100;
                                
                                // Color Map from reference
                                const barColor = {
                                    5: 'bg-[#FF5A1F]',
                                    4: 'bg-[#FF5A1F]',
                                    3: 'bg-[#FFB800]',
                                    2: 'bg-[#FF4D4D]',
                                    1: 'bg-gray-200'
                                }[rating];

                                return (
                                    <div key={rating} className="flex items-center gap-4 group">
                                        <span className="text-[10px] font-black text-gray-400 w-2">{rating}</span>
                                        <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${barColor} rounded-full transition-all duration-1000`}
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-300 w-6 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Feed Area */}
                    <div className="w-full">
                        <ProductReviewList
                            productId={product.id}
                            variantId={selectedVariant?.id}
                            productVariants={allVariants}
                        />
                    </div>
                </div>
            </div>
        );
    }

    try {
        const hasOriginalVariants = allVariants.length > 0;

        const variantOptions = allVariants.map(v => ({
            id: v.id,
            size: v.size_value?.label || v.size || '',
            color: v.color_value?.label || v.color || '',
            weight: v.weight_value?.label || v.weight || '',
            stock: v.available_stock || v.stock || 0,
            price_override: v.price_override || null,
            color_hex: v.color_value?.hex_code || v.color_hex || null,
            image_path: v.image_path || null,
            additional_images: v.additional_images || []
        }));

        const variants = hasOriginalVariants && baseStock > 0 ? [
            {
                id: 'base',
                size: 'Regular',
                color: '',
                weight: '',
                stock: baseStock,
                price_override: null,
                color_hex: null,
                image_path: product.image_path || null,
                additional_images: product.additional_images || []
            },
            ...variantOptions
        ] : variantOptions;

        const hasVariants = variants.length > 0;
        const currentPrice = selectedVariant?.price_override || product.sell_price;

        const currentSaleInfo = selectedVariant
            ? getVariantSaleInfo(selectedVariant, product.sell_price)
            : getProductSaleInfo(product);

        const displayPrice = Number(currentSaleInfo.isOnSale ? currentSaleInfo.salePrice : currentPrice) || 0;

        const currentStock = hasVariants
            ? (selectedVariant ? Number(selectedVariant.stock || 0) : Number(baseStock || 0))
            : Number(baseStock || 0);

        const isOutOfStock = currentStock <= 0;
        const subtotal = displayPrice * qty;
        const canAdd = !isOutOfStock && (!hasVariants || selectedVariant || baseStock > 0);

        const handleVariantChange = (variant, options) => {
            if (selectedVariant?.id !== variant?.id) {
                setActiveGalleryImage(null);
            }
            setSelectedVariant(variant.id === 'base' ? null : variant);
            setSelectedOptions(options);
        };

        const handleAddToCart = () => {
            if (!canAdd) return;
            onAddToCart(product, {
                qty,
                variants: selectedOptions,
                price: displayPrice,
                saleInfo: currentSaleInfo,
                variant_id: selectedVariant?.id,
                isUpdate: !!product.cartId
            });
            onClose();
        };

        const mainImage = selectedVariant ? (selectedVariant.image_path || product.image_path) : product.image_path;
        const additionalImages = selectedVariant ? (selectedVariant.additional_images || []) : (product.additional_images || []);
        const allImages = [mainImage, ...additionalImages].filter(Boolean);
        const displayImage = activeGalleryImage || mainImage;

        const categoryName = product?.category?.name ||
            (product?.name?.includes('PVC') ? 'Plumbing' :
                (product?.name?.includes('Hex Bolt') ? 'Hand Tools' : 'Supplies'));

        return (
            <Modal isOpen={isOpen} onClose={onClose} title="" size="lg" hideFooter hideTitle>
                <div className="flex flex-col md:flex-row overflow-hidden bg-white text-gray-900 border-none shadow-none" style={{ minHeight: '520px' }}>

                    {/* Close Button - More subtle */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-50 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm hover:bg-white transition-all active:scale-90"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>

                    {/* Left Side - Image & Gallery */}
                    <div className="md:w-[50%] p-6 flex flex-col items-center justify-center bg-gray-50/20 relative">
                        {/* Sale Badge */}
                        {currentSaleInfo.isOnSale && (
                            <div className="absolute top-6 left-6 z-10">
                                <span className="bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg">
                                    SALE -{currentSaleInfo.salePercentage}% OFF
                                </span>
                            </div>
                        )}

                        {/* Main Image Box */}
                        <div className="w-full aspect-square relative rounded-2xl bg-white shadow-xl shadow-gray-200/50 border border-gray-100 flex items-center justify-center overflow-hidden mb-4">
                            {displayImage ? (
                                <img
                                    src={`/storage/${displayImage}`}
                                    alt={product.name}
                                    className="w-full h-full object-contain p-4"
                                />
                            ) : (
                                <div className="text-8xl opacity-10">📦</div>
                            )}
                        </div>

                        {/* Thumbnails Row - Fixed height to prevent jump */}
                        <div className="h-16 mt-auto flex items-center justify-center w-full">
                            {allImages.length > 1 && (
                                <div className="flex flex-wrap justify-center gap-3">
                                    {allImages.map((img, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setActiveGalleryImage(img)}
                                            className={`w-14 h-14 rounded-xl border-2 transition-all overflow-hidden bg-white flex items-center justify-center p-1 ${displayImage === img
                                                ? 'border-orange-500 shadow-md ring-2 ring-orange-100'
                                                : 'border-gray-100 hover:border-orange-200'
                                                }`}
                                        >
                                            <img src={`/storage/${img}`} className="w-full h-full object-contain rounded-lg" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side - Details */}
                    <div className="md:w-[50%] p-6 flex flex-col overflow-y-auto max-h-[85vh]">

                        {/* Top Section / Category */}
                        <div className="mb-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5A1F]">
                                {categoryName}
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-black text-gray-900 mb-1 leading-tight tracking-tight">
                            {product.name}
                        </h2>

                        {/* Brand Badge */}
                        {product.brand?.name && (
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                                    {product.brand.name}
                                </span>
                            </div>
                        )}

                        {/* Description */}
                        {product.description && (
                            <p className="text-xs text-gray-500 leading-relaxed mb-3">
                                {product.description}
                            </p>
                        )}

                        {/* Stock Badge */}
                        <div className="mb-4">
                            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold ${isOutOfStock
                                ? 'bg-red-50 text-red-600 border border-red-100'
                                : 'bg-green-50 text-green-600 border border-green-100'
                                }`}>
                                {isOutOfStock ? (
                                    <>Out of Stock</>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        In Stock <span className="text-gray-900 ml-1">{Math.round(currentStock)} units</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Price Area */}
                        <div className="mb-4 bg-[#FFF9F6] border border-[#FFE7DB] rounded-xl p-4 relative overflow-hidden">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-[#FF5A1F]">
                                        ₱{displayPrice.toFixed(2)}
                                    </span>
                                    {currentSaleInfo.isOnSale && (
                                        <span className="text-base text-gray-300 line-through font-bold">
                                            ₱{currentSaleInfo.originalPrice.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                {currentSaleInfo.isOnSale && (
                                    <div className="mt-0.5 flex items-center gap-2">
                                        <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                            Save ₱{currentSaleInfo.savings.toFixed(2)}
                                        </span>
                                        <span className="text-[9px] text-orange-400 font-bold uppercase tracking-wider">Limited Time Offer</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rating & Sold count - Moved Below Price */}
                        {!loadingRating && productRating && (
                            <div className="flex items-center gap-3 mb-6 px-1 mt-2">
                                <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                                    <RatingStars rating={productRating.average_rating || 0} size="sm" />
                                    <span className="text-[10px] font-black text-gray-400 ml-1 mt-0.5">
                                        {Number(productRating.average_rating || 0).toFixed(1)}
                                    </span>
                                </div>
                                <div className="h-4 w-[1px] bg-gray-200"></div>
                                <div className="text-[10px] font-black text-[#FF5A1F] uppercase tracking-wider">
                                    {soldCount || 0} Sold
                                </div>
                                <div className="h-4 w-[1px] bg-gray-200"></div>
                                <button
                                    onClick={handleReviewsClick}
                                    className="text-[10px] font-bold text-gray-400 hover:text-orange-500 transition-colors uppercase tracking-wider underline-offset-4 hover:underline"
                                >
                                    {productRating.total_reviews || 0} Reviews
                                </button>
                            </div>
                        )}

                        {/* Variants Section */}
                        {hasVariants && (
                            <div className="mb-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                                    {(() => {
                                        const hasSize = variants.some(v => v.size);
                                        const hasColor = variants.some(v => v.color);
                                        const hasWeight = variants.some(v => v.weight);

                                        if (hasSize && !hasColor && !hasWeight) return 'SIZES';
                                        if (hasColor && !hasSize && !hasWeight) return 'COLORS';
                                        if (hasWeight && !hasSize && !hasColor) return 'WEIGHTS / KG';
                                        return 'SELECT OPTIONS';
                                    })()}
                                </div>
                                <div className="flex flex-wrap gap-2.5">
                                    {variants.map((v) => {
                                        const isSelected = selectedVariant
                                            ? selectedVariant.id === v.id
                                            : v.id === 'base';

                                        const isOOS = v.stock <= 0;

                                        const getLabel = (v) => {
                                            if (v.id === 'base') return 'Regular';
                                            const parts = [v.size, v.color, v.weight].filter(Boolean);
                                            return parts.join(' / ') || 'Option';
                                        };

                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                disabled={isOOS}
                                                onClick={() => {
                                                    const options = { size: v.size, color: v.color, weight: v.weight };
                                                    handleVariantChange(v, options);
                                                }}
                                                className={`px-4 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${isOOS
                                                    ? 'bg-gray-100 border-transparent text-gray-400 cursor-not-allowed opacity-50'
                                                    : isSelected
                                                        ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-md shadow-orange-200 scale-105'
                                                        : 'bg-white text-gray-700 border-gray-100 hover:border-orange-200'
                                                    }`}
                                            >
                                                {getLabel(v)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Quantity & CTA Section */}
                        <div className="mt-4 flex flex-col gap-6">
                            <div className="flex items-center">
                                <div className="flex items-center border border-gray-100 rounded-full overflow-hidden bg-white shadow-sm ring-1 ring-black/5 p-1 px-1">
                                    <button
                                        onClick={() => setQty(q => Math.max(1, q - 1))}
                                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-400 rounded-full"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <div className="w-10 text-center font-black text-gray-900">
                                        {qty}
                                    </div>
                                    <button
                                        onClick={() => setQty(q => Math.min(q + 1, currentStock))}
                                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-400 rounded-full"
                                        disabled={qty >= currentStock}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    onClick={handleAddToCart}
                                    disabled={!canAdd}
                                    className={`flex-grow h-14 rounded-full text-base font-black transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl ${canAdd
                                        ? 'bg-[#FF5A1F] hover:bg-[#e44e18] text-white shadow-orange-200/40'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    <ShoppingCart className="w-5 h-5" />
                                    {isOutOfStock ? 'SOLD OUT' : 'ADD TO CART'}
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={handleReviewsClick}
                                    className="h-14 w-14 rounded-full border-2 border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-all text-gray-400 hover:text-orange-500 active:scale-90"
                                    title="View Reviews"
                                >
                                    <MessageSquare className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    } catch (error) {
        console.error('Error rendering ProductDetailModal:', error);
        return (
            <Modal isOpen={isOpen} onClose={onClose}>
                <div className="p-6">
                    <h2 className="text-xl font-bold text-red-600">Error Loading Product</h2>
                    <p className="text-sm text-gray-600">Please try again later.</p>
                </div>
            </Modal>
        );
    }
}