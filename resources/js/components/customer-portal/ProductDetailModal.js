import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import VariantSelector from '../shared/VariantSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Percent, ShoppingCart, Minus, Plus, X, MessageSquare, Star } from 'lucide-react';
import { getProductSaleInfo, getVariantSaleInfo } from '../../utils/priceCalculations';
import { useAuth } from '../../context/AuthContext';

export default function ProductDetailModal({ isOpen, onClose, product, onAddToCart }) {
    const [qty, setQty] = useState(1);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState({ size: '', color: '', weight: '' });
    const [activeGalleryImage, setActiveGalleryImage] = useState(null);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [showReviews, setShowReviews] = useState(false);
    const [canReview, setCanReview] = useState(false);
    const [checkingEligibility, setCheckingEligibility] = useState(false);
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

    const checkReviewEligibility = async () => {
        if (!user || !product.id) return;
        
        setCheckingEligibility(true);
        try {
            const response = await fetch(`/api/customers/${user.id}/can-review/${product.id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.status === 'success') {
                setCanReview(data.can_review);
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

    // Show reviews view
    if (showReviews) {
        return (
            <Modal isOpen={isOpen} onClose={onClose}>
                <div className="p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Product Reviews</h2>
                        <Button variant="ghost" onClick={handleBackToProduct}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                    
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
                        <p className="text-sm text-gray-600">See what customers are saying about this product</p>
                    </div>

                    {/* Write Review Button (only for eligible customers) */}
                    {user && canReview && (
                        <div className="mb-6">
                            <Button onClick={() => {
                                const url = selectedVariant 
                                    ? `/shop/products/${product.id}/reviews#write?variant=${selectedVariant.id}`
                                    : `/shop/products/${product.id}/reviews#write`;
                                window.location.href = url;
                            }}>
                                <Star className="w-4 h-4 mr-2" />
                                Write a Review
                            </Button>
                        </div>
                    )}

                    {/* Reviews List Component would go here */}
                    <div className="text-center py-8 text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Reviews component will be integrated here</p>
                        <p className="text-sm mt-2">For now, please use the dedicated reviews page</p>
                    </div>

                    <div className="mt-6 flex justify-center">
                        <Button variant="outline" onClick={handleBackToProduct}>
                            Back to Product
                        </Button>
                    </div>
                </div>
            </Modal>
        );
    }

    try {
        const baseStock = Number(product.available_stock || product.inventory?.current_stock || 0);
        const allVariants = product.product_variants || product.variants || [];
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
                <div className="flex flex-col md:flex-row rounded-2xl overflow-hidden bg-white" style={{ minHeight: '480px' }}>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>

                    {/* Left - Image Panel */}
                    <div className="md:w-[45%] bg-gray-50 flex flex-col items-center justify-center p-6 relative">
                        {/* Sale Badge */}
                        {currentSaleInfo.isOnSale && (
                            <div className="absolute top-4 left-4 z-10">
                                <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow">
                                    SALE -{currentSaleInfo.salePercentage}% OFF
                                </span>
                            </div>
                        )}

                        {/* Main Image */}
                        <div className="w-full aspect-square flex items-center justify-center rounded-xl overflow-hidden mb-4">
                            {displayImage ? (
                                <img
                                    src={`/storage/${displayImage}`}
                                    alt={product.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-8xl opacity-10">📦</div>
                            )}
                        </div>

                        {/* Thumbnails */}
                        {allImages.length > 1 && (
                            <div className="flex gap-2 flex-wrap justify-center">
                                {allImages.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActiveGalleryImage(img)}
                                        className={`w-14 h-14 rounded-lg border-2 overflow-hidden bg-white flex items-center justify-center p-1 transition-all ${
                                            displayImage === img
                                                ? 'border-orange-500 shadow ring-2 ring-orange-100'
                                                : 'border-gray-200 hover:border-orange-300'
                                        }`}
                                    >
                                        <img src={`/storage/${img}`} alt="" className="w-full h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right - Details Panel */}
                    <div className="md:w-[55%] flex flex-col p-6 overflow-y-auto">

                        {/* Category */}
                        <p className="text-xs font-semibold text-orange-500 uppercase tracking-widest mb-1">
                            {categoryName}
                        </p>

                        {/* Product Name */}
                        <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
                            {product.name}
                        </h2>

                        {/* Description */}
                        {product.description && (
                            <p className="text-sm text-gray-500 leading-relaxed mb-4">
                                {product.description}
                            </p>
                        )}

                        {/* Stock Status */}
                        <div className="flex items-center gap-2 mb-4">
                            {isOutOfStock ? (
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-500">
                                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                    Out of Stock
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                    In Stock &nbsp;
                                    <span className="font-bold text-green-700">{Math.round(currentStock)} units</span>
                                </span>
                            )}
                        </div>

                        {/* Price */}
                        <div className="mb-5">
                            {currentSaleInfo.isOnSale ? (
                                <div className="bg-orange-50 rounded-xl px-4 py-3 inline-flex items-center gap-4">
                                    <span className="text-3xl font-bold text-orange-500">
                                        ₱{currentSaleInfo.salePrice.toFixed(2)}
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-sm text-gray-400 line-through">
                                            ₱{currentSaleInfo.originalPrice.toFixed(2)}
                                        </span>
                                        <span className="text-xs text-green-600 font-semibold">
                                            You save ₱{currentSaleInfo.savings.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-3xl font-bold text-orange-500">
                                    ₱{displayPrice.toFixed(2)}
                                </span>
                            )}
                        </div>

                        {/* SKU */}
                        {product.sku && (
                            <p className="text-xs text-gray-400 mb-4">
                                SKU: <span className="font-mono text-gray-600">{product.sku}</span>
                            </p>
                        )}

                        {/* Variants */}
                        {hasVariants && (
                            <div className="mb-5">
                                <VariantSelector
                                    variants={variants}
                                    onVariantChange={handleVariantChange}
                                    selectedVariant={selectedVariant}
                                    showStock={false}
                                    showPrice={false}
                                />
                            </div>
                        )}

                        {/* Quantity */}
                        <div className="mb-5">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Quantity</p>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                    <button
                                        onClick={() => setQty(q => Math.max(1, q - 1))}
                                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-12 text-center font-bold text-gray-900 text-base">
                                        {qty}
                                    </span>
                                    <button
                                        onClick={() => setQty(q => Math.min(q + 1, currentStock))}
                                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <span className="text-sm text-gray-400">{Math.round(currentStock)} units available</span>
                            </div>
                        </div>

                        {/* Add to Cart Button */}
                        <button
                            onClick={handleAddToCart}
                            disabled={!canAdd}
                            className={`w-full h-12 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-md ${
                                canAdd
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            <ShoppingCart className="w-5 h-5" />
                            {isOutOfStock ? 'Sold Out' : `Add to Cart — ₱${subtotal.toFixed(2)}`}
                        </button>

                        {/* Reviews Button */}
                        <Button
                            variant="outline"
                            onClick={handleReviewsClick}
                            className="w-full h-10 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                        >
                            <MessageSquare className="w-4 h-4" />
                            View Reviews
                        </Button>
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