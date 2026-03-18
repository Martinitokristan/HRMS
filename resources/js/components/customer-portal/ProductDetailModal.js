import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import VariantSelector from '../shared/VariantSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ProductDetailModal({ isOpen, onClose, product, onAddToCart }) {
    const [qty, setQty] = useState(1);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState({ size: '', color: '', weight: '' });
    const [activeGalleryImage, setActiveGalleryImage] = useState(null);

    useEffect(() => {
        if (isOpen && product) {
            setQty(product.qty || 1);
            setSelectedVariant(null);
            setSelectedOptions({ size: '', color: '', weight: '' });
            setActiveGalleryImage(null);
        }
    }, [isOpen, product]);

    if (!product) return null;

    // Calculate base values first
    const baseStock = Number(product.inventory?.current_stock || 0);
    const allVariants = product.product_variants || product.variants || [];
    const hasOriginalVariants = allVariants.length > 0;

    // Convert product_variants to format expected by VariantSelector
    const variantOptions = allVariants.map(v => ({
        id: v.id,
        size: v.size_value?.label || v.size || '',
        color: v.color_value?.label || v.color || '',
        weight: v.weight_value?.label || v.weight || '',
        stock: v.stock || 0,
        price_override: v.price_override || null,
        color_hex: v.color_value?.hex_code || v.color_hex || null,
        image_path: v.image_path || null,
        additional_images: v.additional_images || []
    }));

    // Add base product as an option if product has variants and base stock
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
    
    // If variant selected, show variant stock. If no variant selected but has variants, show base stock
    const currentStock = hasVariants 
        ? (selectedVariant ? Number(selectedVariant.stock || 0) : Number(baseStock || 0))
        : Number(baseStock || 0);
    
    const isOutOfStock = currentStock <= 0;
    const subtotal = currentPrice * qty;
    // Can add if: (1) in stock AND (2) either no variants OR variant selected OR base stock available
    const canAdd = !isOutOfStock && (!hasVariants || selectedVariant || baseStock > 0);

    const handleVariantChange = (variant, options) => {
        // Only reset gallery if variant actually changes to a different one
        if (selectedVariant?.id !== variant?.id) {
            setActiveGalleryImage(null);
        }
        // Handle base product selection
        setSelectedVariant(variant.id === 'base' ? null : variant);
        setSelectedOptions(options);
    };

    const handleAddToCart = () => {
        if (!canAdd) return;
        onAddToCart(product, {
            qty,
            variants: selectedOptions,
            price: currentPrice,
            variant_id: selectedVariant?.id,
            isUpdate: !!product.cartId
        });
        onClose();
    };

    // --- Image Gallery Logic --- //
    const mainImage = selectedVariant ? (selectedVariant.image_path || product.image_path) : product.image_path;
    const additionalImages = selectedVariant ? (selectedVariant.additional_images || []) : (product.additional_images || []);
    const allImages = [mainImage, ...additionalImages].filter(Boolean);
    const displayImage = activeGalleryImage || mainImage;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Product Details" size="lg" hideFooter>
            <div className="grid grid-cols-1 md:grid-cols-[1.2fr,1fr] gap-0">
                {/* Left Side - Image & Gallery */}
                <div className="bg-secondary/10 p-6 flex flex-col items-center border-r border-border">
                    {/* Main Image Box - FIXED SIZE */}
                    <div className="w-full aspect-square relative rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden mb-6">
                        {displayImage ? (
                            <img 
                                src={`/storage/${displayImage}`} 
                                alt={product.name} 
                                className="w-full h-full object-contain p-4" 
                            />
                        ) : (
                            <div className="text-8xl opacity-10">🛠️</div>
                        )}
                    </div>

                    {/* Thumbnails Row */}
                    {allImages.length > 1 && (
                        <div className="flex flex-wrap justify-center gap-3">
                            {allImages.map((img, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveGalleryImage(img)}
                                    className={`w-16 h-16 rounded-xl border-2 transition-all overflow-hidden bg-white flex items-center justify-center p-1 ${
                                        displayImage === img 
                                            ? 'border-orange-500 shadow-md ring-2 ring-orange-100' 
                                            : 'border-border hover:border-orange-200'
                                    }`}
                                >
                                    <img src={`/storage/${img}`} alt="" className="w-full h-full object-contain" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Side - Details */}
                <div className="p-6 flex flex-col">
                    {/* Category & Title */}
                    <div className="mb-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-1">
                            {product.category?.name || 'SUPPLIES'}
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2 leading-tight">
                            {product.name}
                        </h2>
                    </div>

                    {/* Description */}
                    {product.description && (
                        <div className="mb-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">DESCRIPTION</div>
                            <p className="text-sm text-foreground leading-relaxed">{product.description}</p>
                        </div>
                    )}

                    {/* Stock Badge */}
                    <div className="mb-4">
                        <Badge variant={isOutOfStock ? "destructive" : "success"} className="text-sm px-3 py-1">
                            {isOutOfStock ? 'Out of Stock' : `${Math.round(currentStock)} units in stock`}
                        </Badge>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                        <div className="text-3xl font-bold text-orange-500">
                            ₱{Number(currentPrice).toFixed(2)}
                        </div>
                    </div>

                    {/* SKU */}
                    {product.sku && (
                        <div className="mb-4 text-sm">
                            <span className="text-muted-foreground font-semibold">SKU:</span>{' '}
                            <span className="font-mono text-foreground">{product.sku}</span>
                        </div>
                    )}

                    {/* Variants - New Modern UI */}
                    {hasVariants && (
                        <div className="mb-6">
                            <VariantSelector
                                variants={variants}
                                onVariantChange={handleVariantChange}
                                selectedVariant={selectedVariant}
                                showStock={false}
                                showPrice={false}
                            />
                        </div>
                    )}

                    {/* Quantity & Add to Cart */}
                    <div className="mt-auto pt-4 border-t border-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center border-2 border-gray-300 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setQty(q => Math.max(1, q - 1))}
                                    className="px-3 py-2 hover:bg-secondary transition-colors text-lg font-bold"
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 text-center border-x-2 border-gray-300 py-2 font-bold text-lg focus:outline-none"
                                    readOnly
                                />
                                <button
                                    onClick={() => setQty(q => Math.min(q + 1, currentStock))}
                                    className="px-3 py-2 hover:bg-secondary transition-colors text-lg font-bold"
                                >
                                    +
                                </button>
                            </div>
                            <span className="text-sm text-muted-foreground">{Math.round(currentStock)} units in stock</span>
                        </div>
                        <Button
                            className="w-full h-12 text-base font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                            onClick={handleAddToCart}
                            disabled={!canAdd}
                        >
                            🛒 {isOutOfStock ? 'Sold Out' : `Order (₱${subtotal.toFixed(2)})`}
                        </Button>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button variant="outline">View Full Specs</Button>
                    </div>
                </div>
            </div>

        </Modal>
    );
}
