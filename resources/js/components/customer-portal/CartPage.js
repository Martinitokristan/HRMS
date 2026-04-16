import React, { useState, useEffect } from 'react';

import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import ProductDetailModal from './ProductDetailModal';
import Modal from '../shared/Modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Trash2, ShoppingCart, Minus, Plus, Check, X, Package, ArrowRight } from 'lucide-react';

export default function CartPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Load cart from localStorage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('hrms_cart');
        if (savedCart) {
            try {
                const parsed = JSON.parse(savedCart);
                // Ensure all items have a selectedForCheckout property
                const updated = parsed.map(item => ({
                    ...item,
                    selectedForCheckout: item.selectedForCheckout !== undefined ? item.selectedForCheckout : true
                }));
                setCart(updated);
            } catch (e) {
                console.error('Error parsing cart:', e);
            }
        }
    }, []);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('hrms_cart', JSON.stringify(cart));
    }, [cart]);

    const updateQty = (cartId, delta) => {
        setCart(prev => {
            const updated = prev.map(item => {
                if (item.cartId === cartId) {
                    const newQty = Math.max(1, item.qty + delta);
                    return { ...item, qty: newQty };
                }
                return item;
            });
            return updated;
        });
    };

    const removeItem = (cartId) => {
        setCart(prev => prev.filter(item => item.cartId !== cartId));
        showToast('Item removed from cart', 'success');
    };

    const clearCart = () => {
        setCart([]);
        setShowClearConfirm(false);
        showToast('Cart cleared', 'success');
    };

    const updateCartItem = (product, options) => {
        const qty = options.qty || 1;
        const variants = options.variants || {};
        const price = options.price || product.sell_price;
        const variant_id = options.variant_id || null;

        const variantLabels = Object.values(variants)
            .filter(Boolean)
            .map(v => v.label);
        const variantString = variantLabels.join(', ');
        const newCartId = variantString ? `${product.id}-${variantString}` : product.id;

        // Remove old item and add updated one
        setCart(prev => {
            const filtered = prev.filter(i => i.cartId !== product.cartId);
            const existing = filtered.find(i => i.cartId === newCartId);
            if (existing) {
                return filtered.map(i => i.cartId === newCartId ? { ...i, qty: i.qty + qty } : i);
            }
            return [...filtered, { ...product, sell_price: price, cartId: newCartId, qty, variantString, selectedVariants: variants, variant_id }];
        });
        setSelectedProduct(null);
        showToast('Item updated', 'success');
    };

    const switchVariant = (item, newVariant) => {
        // Check if new variant is in stock
        if ((newVariant.stock || 0) <= 0) {
            showToast('This variant is out of stock', 'error');
            return;
        }

        const variantLabels = [];
        if (newVariant.size_value) variantLabels.push(newVariant.size_value.label || newVariant.size_value);
        if (newVariant.color_value) variantLabels.push(newVariant.color_value.label || newVariant.color_value);
        if (newVariant.weight_value) variantLabels.push(newVariant.weight_value.label || newVariant.weight_value);
        
        const variantString = variantLabels.join(', ');
        const newCartId = variantString ? `${item.id}-${variantString}` : item.id;
        const newPrice = newVariant.price_override || item.sell_price;

        setCart(prev => {
            // Check if this variant already exists in cart
            const existing = prev.find(i => i.cartId === newCartId && i.cartId !== item.cartId);
            if (existing) {
                // Merge quantities
                const filtered = prev.filter(i => i.cartId !== item.cartId);
                return filtered.map(i => 
                    i.cartId === newCartId 
                        ? { ...i, qty: i.qty + item.qty }
                        : i
                );
            }
            
            // Update to new variant
            return prev.map(i => 
                i.cartId === item.cartId 
                    ? { 
                        ...i, 
                        cartId: newCartId,
                        variant_id: newVariant.id,
                        variantString,
                        sell_price: newPrice,
                        selectedVariants: {
                            Size: newVariant.size_value,
                            Color: newVariant.color_value,
                            Weight: newVariant.weight_value
                        }
                    }
                    : i
            );
        });
        showToast(`Switched to ${variantString}`, 'success');
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.sell_price * item.qty), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const handleCheckout = () => {
        const selectedCount = cart.filter(item => item.selectedForCheckout).length;
        if (selectedCount === 0) {
            showToast('Please select at least one item to checkout', 'error');
            return;
        }
        navigate('/shop/order');
    };

    const toggleSelection = (cartId) => {
        setCart(prev => prev.map(item => 
            item.cartId === cartId ? { ...item, selectedForCheckout: !item.selectedForCheckout } : item
        ));
    };

    if (cart.length === 0) {
        return (
            <div className="min-h-screen bg-secondary/30 pb-8">
                <header className="sticky top-0 z-50 bg-white border-b border-border px-[5%] py-4 flex items-center justify-between">
                    <Link to="/shop" className="text-sm font-semibold text-foreground no-underline flex items-center gap-1.5 hover:text-primary transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Back to Shop
                    </Link>
                    <h1 className="text-lg font-bold text-foreground">My Cart</h1>
                    <div className="w-[100px]" />
                </header>
                <Card className="max-w-lg mx-auto mt-16 text-center py-12 px-8">
                    <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h2 className="text-xl font-bold text-foreground mb-2">Your cart is empty</h2>
                    <p className="text-muted-foreground mb-6">Looks like you haven't added any items yet.</p>
                    <Button onClick={() => navigate('/shop')}>Start Shopping</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-secondary/30 pb-8">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-border px-[5%] py-4 flex items-center justify-between">
                <Link to="/shop" className="text-sm font-semibold text-foreground no-underline flex items-center gap-1.5 hover:text-primary transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Shop
                </Link>
                <h1 className="text-lg font-bold text-foreground">My Cart ({cartCount})</h1>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowClearConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Clear
                </Button>
            </header>

            <div className="max-w-2xl mx-auto px-4 mt-6">
                {/* Cart Items */}
                <div className="space-y-3 mb-6">
                    {cart.map((item) => (
                        <Card
                            key={item.cartId}
                            onClick={() => toggleSelection(item.cartId)}
                            className={`p-4 flex gap-4 items-center cursor-pointer transition-all relative ${
                                item.selectedForCheckout ? 'border-2 border-primary shadow-md shadow-primary/10 -translate-y-0.5' : 'border-2 border-transparent'
                            }`}
                        >
                            {/* Selection Indicator */}
                            {item.selectedForCheckout && (
                                <div className="absolute top-3 right-3 h-6 w-6 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/30">
                                    <Check className="h-3.5 w-3.5 text-white" />
                                </div>
                            )}

                            {/* Product Image */}
                            <div className="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center text-3xl shrink-0 overflow-hidden border border-border">
                                {item.image_path ? (
                                    <img src={`/storage/${item.image_path}`} alt={item.name} className="w-full h-full object-cover" />
                                ) : <Package className="h-8 w-8 opacity-20 text-muted-foreground" />}
                            </div>

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-foreground truncate">{item.name}</h3>
                                        {item.brand?.name && (
                                            <p className="text-xs font-semibold text-orange-500 leading-none mt-0.5">{item.brand.name}</p>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={(e) => { e.stopPropagation(); removeItem(item.cartId); }}
                                        aria-label="Remove item"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {item.variantString && (
                                    <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">{item.variantString}</div>
                                )}

                                <div className="flex items-end justify-between mt-2">
                                    <div className="flex items-center gap-0 bg-secondary rounded-xl border border-border">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-xl rounded-r-none" onClick={(e) => { e.stopPropagation(); updateQty(item.cartId, -1); }}>
                                            <Minus className="h-3.5 w-3.5" />
                                        </Button>
                                        <span className="font-bold text-sm min-w-[32px] text-center">{item.qty}</span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-xl rounded-l-none" onClick={(e) => { e.stopPropagation(); updateQty(item.cartId, 1); }}>
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground">₱{Number(item.sell_price).toFixed(2)}</div>
                                        <div className="text-lg font-black text-foreground">₱{(item.sell_price * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Checkout Button */}
                <Button className="w-full h-12 text-base font-bold gap-2 mb-3" onClick={handleCheckout}>
                    Proceed to Checkout <ArrowRight className="h-4 w-4" />
                </Button>

                {/* Continue Shopping */}
                <Button variant="outline" className="w-full h-11 text-base font-semibold gap-2" onClick={() => navigate('/shop')}>
                    <ArrowLeft className="h-4 w-4" /> Continue Shopping
                </Button>
            </div>

            {/* Product Detail Modal for Editing */}
            <ProductDetailModal
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                product={selectedProduct}
                onAddToCart={(prod, opts) => updateCartItem(prod, opts)}
            />

            {/* Clear Cart Confirmation */}
            <Modal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                title="Clear Cart?"
                size="sm"
                hideFooter
            >
                <div className="py-4">
                    <p className="text-muted-foreground mb-6">Are you sure you want to remove all items from your cart?</p>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                        <Button variant="destructive" className="flex-1" onClick={clearCart}>Clear Cart</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
