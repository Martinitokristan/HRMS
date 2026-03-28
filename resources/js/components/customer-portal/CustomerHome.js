import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProductDetailModal from './ProductDetailModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, X, Package, ClipboardList, LogOut, Bell, Percent } from 'lucide-react';
import { getProductSaleInfo } from '../../utils/priceCalculations';
import RatingStars from '../ui/RatingStars';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

// Product card component (removed memo to allow stock updates)
const ProductCard = ({ product, onAddToCart, setSelectedProduct }) => {
    const allVariants = product.product_variants || [];
    const hasVariants = allVariants && allVariants.length > 0;
    const totalVariantStock = allVariants ? allVariants.reduce((s, v) => s + Number(v.available_stock || v.stock || 0), 0) : 0;
    const baseStock = Number(product.available_stock || product.inventory?.current_stock || 0);
    const totalStock = baseStock;
    const inStock = totalStock > 0;
    const imgSrc = product.image_path ? `/storage/${product.image_path}` : null;
    const [addingToCart, setAddingToCart] = useState(false);
    const [productRating, setProductRating] = useState(null);
    const [soldCount, setSoldCount] = useState(null);

    // Calculate sale information
    const saleInfo = getProductSaleInfo(product);

    // Get unique sizes and colors for display
    const sizes = allVariants ? [...new Set(allVariants.map(v => v.size_value?.label).filter(Boolean))] : [];
    const colors = allVariants ? [...new Set(allVariants.map(v => v.color_value?.label).filter(Boolean))] : [];

    // Fetch product rating and sold count (optimized - use prop data if exists)
    useEffect(() => {
        const fetchProductData = async () => {
            if (!product?.id) return;

            // Use existing rating data from prop to avoid loading if possible
            if (product.average_rating !== undefined && product.total_reviews !== undefined && !productRating) {
                setProductRating({
                    average_rating: product.average_rating,
                    total_reviews: product.total_reviews
                });
            }

            try {
                // Fetch sold count only if we don't have it (or always refresh metadata)
                const soldResponse = await fetch(`/api/products/${product.id}/sold-count`);
                if (soldResponse.ok) {
                    const soldData = await soldResponse.json();
                    if (soldData.status === 'success') {
                        setSoldCount(soldData.sold_count || 0);
                    }
                }

                // Refresh rating data in background if not already initialized
                if (!productRating) {
                    const ratingResponse = await fetch(`/api/products/${product.id}/reviews`);
                    if (ratingResponse.ok) {
                        const ratingData = await ratingResponse.json();
                        if (ratingData.data?.summary) {
                            setProductRating(ratingData.data.summary);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching product metadata:', error);
            }
        };

        fetchProductData();
    }, [product?.id]);

    const handleAddToCart = async (e) => {
        e.stopPropagation();
        setAddingToCart(true);
        try {
            // For products with variants, add the first available variant or base product
            let selectedVariant = null;
            let selectedVariantOptions = {};

            if (hasVariants) {
                // Find the first available variant
                const availableVariant = allVariants.find(v => (v.available_stock || v.stock || 0) > 0);

                if (availableVariant) {
                    selectedVariant = availableVariant;
                    selectedVariantOptions = {
                        size: availableVariant.size_value?.label || '',
                        color: availableVariant.color_value?.label || '',
                        weight: availableVariant.weight_value?.label || ''
                    };
                } else {
                    // If no variant has stock, try base product
                    if (baseStock > 0) {
                        selectedVariant = null;
                        selectedVariantOptions = {};
                    } else {
                        throw new Error('No stock available');
                    }
                }
            }

            await onAddToCart(product, {
                qty: 1,
                variants: selectedVariantOptions,
                price: selectedVariant ?
                    (selectedVariant.price_override || product.sell_price) :
                    (saleInfo.isOnSale ? saleInfo.salePrice : product.sell_price),
                saleInfo: saleInfo,
                variant_id: selectedVariant?.id || null,
                isUpdate: !!product.cartId
            });
        } catch (error) {
            console.error('Error adding to cart:', error);
            // Error is handled in parent component
        } finally {
            setAddingToCart(false);
        }
    };

    return (
        <div
            className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-xl hover:shadow-gray-300/10 hover:-translate-y-1"
            onClick={() => setSelectedProduct(product)}
        >
            {/* Image Container with Badges */}
            <div className="relative aspect-[1.1/1] overflow-hidden bg-gray-50/50 border-b border-gray-100/50">
                {/* Product Image */}
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div
                    className="w-full h-full flex items-center justify-center bg-gray-50"
                    style={{ display: imgSrc ? 'none' : 'flex' }}
                >
                    <Package className="h-10 w-10 text-gray-200" />
                </div>

                {/* Badges Overlay */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                    {/* Category Label */}
                    <span className="bg-[#FF5A1F] text-white text-[7px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded-full shadow-lg shadow-orange-500/20">
                        {product.category?.name || 'Hand Tools'}
                    </span>

                    {/* Sale Badge */}
                    {saleInfo.isOnSale && (
                        <span className="bg-[#FF4D4D] text-white text-[7px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded-full shadow-lg shadow-red-500/20">
                            SALE -{saleInfo.salePercentage}%
                        </span>
                    )}
                </div>

                {/* Out of Stock Overlay */}
                {!inStock && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                        <span className="bg-gray-900 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full shadow-2xl">
                            Sold Out
                        </span>
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="p-4 space-y-3">
                <div className="min-h-[60px]">
                    <h3 className="text-base font-black text-gray-900 mb-1 leading-tight group-hover:text-[#FF5A1F] transition-colors line-clamp-1">{product.name}</h3>
                    <p className="text-[9px] text-gray-500 leading-normal line-clamp-2 font-medium">
                        {product.description || "Premium quality product designed for durability and high performance in all specific applications."}
                    </p>
                </div>

                {/* Stock Indicator Pill - Mini Spec Modal Style */}
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50">
                    <span className="text-[8.5px] font-black text-emerald-600 uppercase tracking-widest leading-none">Stock</span>
                    <span className="text-[8.5px] font-black text-gray-900 uppercase tracking-widest leading-none">
                        {totalStock} units
                    </span>
                </div>

                {/* Pricing Area - Vertical Tight */}
                <div className="pt-1.5 pb-0.5">
                    <div className="flex items-end gap-2">
                        <div className="text-lg font-black text-[#FF5A1F] leading-none tracking-tighter">
                            ₱{saleInfo.isOnSale ? saleInfo.salePrice.toFixed(2) : saleInfo.originalPrice.toFixed(2)}
                        </div>
                        {saleInfo.isOnSale && (
                           <span className="text-[9px] text-gray-400 line-through font-bold leading-none mb-0.5">
                               ₱{saleInfo.originalPrice.toFixed(2)}
                           </span>
                        )}
                    </div>
                </div>

                {/* Social Proof Row - Tucked Closely */}
                <div className="flex items-center gap-3 pt-1 border-t border-gray-100/30">
                    <div className="flex items-center gap-1.5">
                        <div className="scale-90 origin-left -ml-0.5">
                            <RatingStars rating={productRating?.average_rating || 0} size="sm" showCount={false} />
                        </div>
                        <span className="text-[11px] font-black text-gray-900 leading-none">
                            {Number(productRating?.average_rating || 0).toFixed(1)}
                        </span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest leading-none whitespace-nowrap">
                        {soldCount || 0} SOLD
                    </span>
                </div>

                {/* Interactive Area */}
                <button
                    disabled={!inStock || addingToCart}
                    onClick={handleAddToCart}
                    className="w-full h-9 bg-[#FF5A1F] hover:bg-orange-600 active:scale-95 text-white rounded-lg transition-all duration-300 shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2 disabled:bg-gray-100 disabled:text-gray-300"
                >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-[0.1em]">
                        {addingToCart ? 'Wait...' : 'Add to Cart'}
                    </span>
                </button>
            </div>
        </div>
    );
};

export default function CustomerHome() {
    const { user, logout, categories } = useAuth();
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [cart, setCart] = useState([]);
    const [flyingItem, setFlyingItem] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    const { refreshTrigger } = useSilentRefresh('customer_shop');

    const [confirmModal, setConfirmModal] = useState({
        show: false, title: '', message: '',
        onConfirm: null, variant: 'default'
    });
    
    const showConfirm = (title, message, onConfirm, variant = 'default') => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };
    
    const closeConfirm = () => {
        setConfirmModal({
            show: false, title: '', message: '',
            onConfirm: null, variant: 'default'
        });
    };

    // Notifications
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifOpen, setNotifOpen] = useState(false);
    const [proofModalUrl, setProofModalUrl] = useState(null);
    const notifRef = useRef(null);

    // Load cart from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('hrms_cart');
        if (saved) try { setCart(JSON.parse(saved)); } catch (e) { }
    }, []);

    useEffect(() => { localStorage.setItem('hrms_cart', JSON.stringify(cart)); }, [cart]);

    // Listen for cart updates from other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'hrms_cart') {
            loadCartFromStorage();
        }
    });

    // Listen for order placement to refresh product list
    window.addEventListener('orderPlaced', (e) => {
        console.log('Order placed event received, refreshing products...');
        // Force refresh of products to update stock
        setLoading(true);
        const params = {
            page: 1,
            per_page: 20,
            _: Date.now(),
            v: '1.2',
            r: Math.random().toString(36).substring(7)
        };
        if (search) params.search = search;
        if (categoryFilter) params.category_id = categoryFilter;

        axios.get('/products', { params })
            .then(r => {
                const d = r.data?.data;
                setProducts(d?.data ? d.data : d);
            })
            .finally(() => {
                setLoading(false);
            });
    });

    // Cart bump animation
    useEffect(() => {
        if (flyingItem) {
            const t = setTimeout(() => {
                const btn = document.getElementById('cart-icon-btn');
                const badge = document.getElementById('cart-count-badge');
                if (btn) { btn.classList.add('cart-bump'); setTimeout(() => btn.classList.remove('cart-bump'), 300); }
                if (badge) { badge.classList.add('badge-pulse'); setTimeout(() => badge.classList.remove('badge-pulse'), 400); }
            }, 600);
            return () => clearTimeout(t);
        }
    }, [flyingItem]);

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch products with debouncing
    useEffect(() => {
        let isMounted = true;
        let debounce;

        const fetchData = (silent = false) => {
            if (!silent) setLoading(true);
            // Add aggressive cache-busting with timestamp and random string
            const params = {
                page: 1,
                per_page: 20,
                _: Date.now(),
                v: '1.2',
                r: Math.random().toString(36).substring(7)
            };
            if (search) params.search = search;
            if (categoryFilter) params.category_id = categoryFilter;

            axios.get('/products', { params })
                .then(r => {
                    if (isMounted) {
                        const d = r.data?.data;
                        const productsData = d?.data ? d.data : d;
                        setProducts(productsData);
                    }
                })
                .catch(err => {
                    // never wipe existing data on background error
                })
                .finally(() => {
                    if (isMounted && !silent) setLoading(false);
                });
        };

        // Debounce search to reduce API calls (400ms for responsive UX)
        debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchData(products.length > 0);
        }, 400);

        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [search, categoryFilter, refreshTrigger]);

    // Fetch notifications (optimized - real-time polling)
    useEffect(() => {
        if (!user) return;
        const fetchNotifs = () => {
            axios.get('/customer/notifications').then(r => {
                setNotifications(r.data?.data || []);
                setUnreadCount(r.data?.unread || 0);
            }).catch(() => { });
        };
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 5000);
        return () => clearInterval(interval);
    }, [user]);

    const markRead = () => {
        if (unreadCount > 0) {
            axios.post('/customer/notifications/read').then(() => {
                setUnreadCount(0);
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            });
        }
    };

    const addToCart = async (product, options = {}) => {
        const qty = options.qty || 1;
        const variants = options.variants || {};
        const price = options.price || product.sell_price;
        const variant_id = options.variant_id || null;
        const isUpdate = options.isUpdate || false;
        const variantLabels = Object.values(variants).filter(Boolean).map(v => v.label);
        const variantString = variantLabels.join(', ');
        const cartId = variantString ? `${product.id}-${variantString}` : product.id;

        // Add to cart without reservation
        setCart(prev => {
            if (isUpdate && product.cartId !== cartId) {
                const filtered = prev.filter(i => i.cartId !== product.cartId);
                const existing = filtered.find(i => i.cartId === cartId);
                if (existing) return filtered.map(i => i.cartId === cartId ? { ...i, qty: i.qty + qty } : i);
                return [...filtered, { ...product, sell_price: price, cartId, qty, variantString, selectedVariants: variants, variant_id }];
            }
            const existing = prev.find(i => i.cartId === cartId);
            if (existing) return prev.map(i => i.cartId === cartId ? { ...i, qty: isUpdate ? qty : i.qty + qty, selectedVariants: variants, sell_price: price } : i);
            return [...prev, { ...product, sell_price: price, cartId, qty, variantString, selectedVariants: variants, variant_id }];
        });

        // Trigger flying animation
        setFlyingItem({ id: product.id, name: product.name });
        setTimeout(() => setFlyingItem(null), 1000);
    };

    const cartCount = cart.reduce((s, i) => s + i.qty, 0);

    return (
        <div className="min-h-screen bg-white">
            {/* ===== STICKY HEADER ===== */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="max-w-[1500px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/shop')}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF5A1F] text-white font-bold text-sm">H</div>
                        <div className="text-base font-bold text-gray-900">HRMS</div>
                    </div>

                    {/* Centered Search */}
                    <div className="flex-1 max-w-xl mx-auto relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full h-9 pl-9 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                        />
                        {search && (
                            <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setSearch('')}>
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-8 shrink-0">
                        {/* Cart */}
                        <button id="cart-icon-btn" className="relative flex items-center gap-2 text-gray-700 hover:text-gray-900" onClick={() => navigate('/shop/cart')}>
                            <div className="relative">
                                <ShoppingCart className="h-5 w-5" />
                                {cartCount > 0 && (
                                    <span id="cart-count-badge" className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">{cartCount}</span>
                                )}
                            </div>
                            <span className="text-sm font-medium hidden sm:inline">Cart</span>
                        </button>

                        {user ? (
                            <>
                                {/* Notifications Toggle */}
                                <div ref={notifRef} className="relative">
                                    <button
                                        className="relative flex items-center gap-2 text-gray-700 hover:text-gray-900"
                                        onClick={() => {
                                            setNotifOpen(!notifOpen);
                                            if (!notifOpen && unreadCount > 0) markRead();
                                        }}
                                    >
                                        <div className="relative">
                                            <Bell className="h-5 w-5" />
                                            {unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    {notifOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-50 max-h-96 overflow-y-auto">
                                            <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                                                <span className="font-bold text-gray-900">Notifications</span>
                                            </div>
                                            {notifications.length === 0 ? (
                                                <div className="px-4 py-8 text-center text-sm text-gray-500">
                                                    No notifications yet
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    {notifications.map((n, i) => (
                                                        <div key={i} className={`px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                                                            {/* HRMS | Time Format */}
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-bold text-orange-500 tracking-wider uppercase">
                                                                    {n.meta?.sender_name || 'HRMS'}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
                                                            </div>
                                                            <div className="text-sm font-semibold text-gray-900 mb-1 leading-snug">{n.title}</div>
                                                            <div className="text-xs text-gray-600 mb-2 leading-relaxed">{n.message}</div>

                                                            {n.meta?.proof_url && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setProofModalUrl(n.meta.proof_url); }}
                                                                    className="mt-1 w-full flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold py-1.5 px-3 rounded-md transition-colors"
                                                                >
                                                                    <Package className="h-3 w-3" /> View Proof
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button className="flex items-center gap-2 text-gray-700 hover:text-gray-900 text-sm font-medium hidden sm:flex" onClick={() => navigate('/shop/history')}>
                                    <ClipboardList className="h-5 w-5" /> My Orders
                                </button>
                                <div ref={profileRef} className="relative">
                                    <div
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-bold cursor-pointer"
                                        onClick={() => setProfileOpen(!profileOpen)}
                                    >
                                        {user.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    {profileOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                                            <div className="px-3 py-2 border-b border-gray-200">
                                                <div className="text-xs font-semibold text-gray-900 truncate">{user.name}</div>
                                                <div className="text-[11px] text-gray-500 truncate">{user.email}</div>
                                            </div>
                                            <button onClick={() => { navigate('/shop/history'); setProfileOpen(false); }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left sm:hidden">
                                                <ClipboardList className="h-4 w-4" /> My Orders
                                            </button>
                                            <button onClick={() => { logout(); navigate('/'); setProfileOpen(false); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors w-full text-left">
                                                <LogOut className="h-4 w-4" /> Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" asChild><Link to="/login">Sign In</Link></Button>
                        )}
                    </div>
                </div>
            </header>

            {/* ===== CATEGORY TABS ===== */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-[1500px] mx-auto px-6">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        <button
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${!categoryFilter
                                    ? 'text-orange-500 border-b-2 border-orange-500'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                            onClick={() => setCategoryFilter('')}
                        >
                            All Products
                        </button>
                        {categories.map(c => (
                            <button
                                key={c.id}
                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter == c.id
                                        ? 'text-orange-500 border-b-2 border-orange-500'
                                        : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                onClick={() => setCategoryFilter(c.id)}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== PRODUCT GRID ===== */}
            <main className="max-w-[1500px] mx-auto px-6 py-6">
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900">
                        {categoryFilter ? categories.find(c => c.id == categoryFilter)?.name || 'Products' : 'Product Catalog'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{products?.length || 0} items available</p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {[...Array(12)].map((_, i) => (
                            <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
                                <div className="aspect-[1.1/1] bg-gray-50" />
                                <div className="p-4 space-y-3">
                                    <div className="h-5 bg-gray-50 rounded w-4/5" />
                                    <div className="h-3 bg-gray-50 rounded w-full" />
                                    <div className="h-4 bg-gray-50 rounded w-2/5" />
                                    <div className="h-8 bg-gray-50 rounded w-full mt-2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (!products || products.length === 0) ? (
                    <div className="text-center py-20 px-8 bg-white border border-gray-200 rounded-lg">
                        <Package className="h-12 w-12 mx-auto mb-4 text-gray-400 opacity-30" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No products found</h3>
                        <p className="text-sm text-gray-500 mb-6">Try adjusting your search or category filter.</p>
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => { setSearch(''); setCategoryFilter(''); }}>Clear Filters</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {(products || []).map(p => (
                            <ProductCard
                                key={`${p.id}-${p.available_stock || p.inventory?.current_stock || 0}`}
                                product={p}
                                onAddToCart={addToCart}
                                setSelectedProduct={setSelectedProduct}
                            />
                        ))}
                    </div>
                )}
            </main>

            <ProductDetailModal
                key={selectedProduct?.id || 'modal'}
                isOpen={!!selectedProduct}
                onClose={() => {
                    setSelectedProduct(null);
                }}
                product={selectedProduct}
                onAddToCart={addToCart}
            />

            {/* Flying Item Animation */}
            {flyingItem && (
                <div className="flying-item" style={{
                    '--start-x': `${flyingItem.startX}px`, '--start-y': `${flyingItem.startY}px`,
                    '--end-x': `${flyingItem.endX}px`, '--end-y': `${flyingItem.endY}px`,
                }}>
                    {flyingItem.img ? <img src={flyingItem.img} alt="" /> : <Package className="h-8 w-8 text-primary" />}
                </div>
            )}

            {/* Full Screen Proof Modal */}
            {proofModalUrl && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setProofModalUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                                <Package className="h-5 w-5 text-orange-500" /> Delivery Proof
                            </h3>
                            <button onClick={() => setProofModalUrl(null)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors bg-white border border-gray-200 shadow-sm">
                                <X className="h-5 w-5 text-gray-700" />
                            </button>
                        </div>
                        <div className="p-0 overflow-auto flex-1 bg-[#111] flex items-center justify-center min-h-[400px]">
                            <img src={proofModalUrl} alt="Full Delivery Proof" className="max-w-full max-h-[75vh] object-contain shadow-lg" />
                        </div>
                        <div className="p-4 bg-white border-t flex justify-end shrink-0">
                            <button onClick={() => setProofModalUrl(null)} className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition-colors">
                                Close Overlay
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
