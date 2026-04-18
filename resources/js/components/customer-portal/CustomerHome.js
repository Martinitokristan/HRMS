import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api, { silentApi } from '../../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProductDetailModal from './ProductDetailModal';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, X, Package, ClipboardList, LogOut, Bell, Settings, Sparkles } from 'lucide-react';
import { getProductSaleInfo } from '../../utils/priceCalculations';
import RatingStars from '../ui/RatingStars';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { STALE_KEYS, markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';
import NotificationPanel from '../shared/NotificationPanel';
import ProductCarousel from './ProductCarousel';
import Tooltip from '../shared/Tooltip';

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

    // Calculate sale information
    const saleInfo = getProductSaleInfo(product);

    // Read aggregated data directly from product prop (provided by API index response)
    const averageRating = Number(product.average_rating || 0);
    const totalReviews  = Number(product.total_reviews  || 0);
    const soldCount     = Number(product.sold_count     || 0);

    // Get unique sizes and colors for display
    const sizes = allVariants ? [...new Set(allVariants.map(v => v.size_value?.label).filter(Boolean))] : [];
    const colors = allVariants ? [...new Set(allVariants.map(v => v.color_value?.label).filter(Boolean))] : [];

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
            // silent fail
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
            <div className="relative aspect-[3/2] overflow-hidden bg-white border-b border-gray-100/50">
                {/* Product Image */}
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-700 ease-out"
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
                    <span className="bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg shadow-orange-500/20">
                        {product.category?.name || 'Hand Tools'}
                    </span>

                    {/* Sale Badge */}
                    {saleInfo.isOnSale && (
                        <span className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg shadow-red-500/20">
                            SALE -{saleInfo.salePercentage}%
                        </span>
                    )}
                </div>

                {/* Out of Stock Overlay */}
                {!inStock && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                        <span className="bg-gray-900 text-white text-xs font-semibold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full shadow-2xl">
                            Sold Out
                        </span>
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="p-4 space-y-3">
                <div className="min-h-[60px]">
                    <h3 className="text-base font-black text-gray-900 mb-1 leading-tight group-hover:text-orange-500 transition-colors line-clamp-1">{product.name}</h3>
                    {product.brand?.name && (
                        <p className="text-xs text-orange-500 font-semibold mt-0.5 leading-none">{product.brand.name}</p>
                    )}
                    <p className="text-xs text-gray-500 leading-normal line-clamp-2 font-medium">
                        {product.description || "Premium quality product designed for durability and high performance in all specific applications."}
                    </p>
                </div>

                {/* Stock Indicator Pill - Mini Spec Modal Style */}
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50">
                    <span className="text-xs font-semibold text-emerald-600 leading-none">Stock</span>
                    <span className="text-xs font-semibold text-gray-900 leading-none">
                        {totalStock} units
                    </span>
                </div>

                {/* Pricing Area - Vertical Tight */}
                <div className="pt-1.5 pb-0.5">
                    <div className="flex items-end gap-2">
                        <div className="text-lg font-black text-orange-500 leading-none tracking-tighter">
                            ₱{saleInfo.isOnSale ? saleInfo.salePrice.toFixed(2) : saleInfo.originalPrice.toFixed(2)}
                        </div>
                        {saleInfo.isOnSale && (
                           <span className="text-xs text-gray-400 line-through font-bold leading-none mb-0.5">
                               ₱{saleInfo.originalPrice.toFixed(2)}
                           </span>
                        )}
                    </div>
                </div>

                {/* Ratings & Sold Summary - Inline Mini */}
                <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100/50">
                        <RatingStars rating={averageRating} size="sm" color="text-amber-500" showCount={false} />
                        <span className="text-xs font-semibold text-amber-700 leading-none">
                            {averageRating.toFixed(1)}
                        </span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                    <span className="text-xs text-gray-500 leading-none whitespace-nowrap">
                        {soldCount} SOLD
                    </span>
                </div>

                {/* Interactive Area */}
                <button
                    disabled={!inStock || addingToCart}
                    onClick={handleAddToCart}
                    className="w-full h-9 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2 disabled:bg-gray-100 disabled:text-gray-300"
                >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">
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

    // Background Sync
    const shopRefresh = useSilentRefresh(STALE_KEYS.CUSTOMER_SHOP);
    const notifRefresh = useSilentRefresh(STALE_KEYS.CUSTOMER_NOTIFICATIONS);

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

    // Recommendations
    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(true);
    const searchLogTimerRef = useRef(null);

    // Load cart from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('hrms_cart');
        if (saved) try { setCart(JSON.parse(saved)); } catch (e) { }
    }, []);

    useEffect(() => { localStorage.setItem('hrms_cart', JSON.stringify(cart)); }, [cart]);

    // Listen for storage events (cart)
    const loadCartFromStorage = useCallback(() => {
        const saved = localStorage.getItem('hrms_cart');
        if (saved) try { setCart(JSON.parse(saved)); } catch (e) { }
    }, []);

    // Listen for order placement to refresh product list
    useEffect(() => {
        const handleOrderPlaced = () => {
            markStale(STALE_KEYS.CUSTOMER_SHOP);
        };
        window.addEventListener('orderPlaced', handleOrderPlaced);
        return () => {
            window.removeEventListener('orderPlaced', handleOrderPlaced);
        };
    }, []);

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

            silentApi.get('/products', { params })
                .then(r => {
                    if (isMounted) {
                        // Data extraction: r.data.data is the paginator object, r.data.data.data is the array
                        const responseData = r.data?.data;
                        const actualData = Array.isArray(responseData) ? responseData : (responseData?.data || []);
                        setProducts(actualData);
                    }
                })
                .catch(() => {
                    // silent fail — never wipe existing data on background error
                })
                .finally(() => {
                    if (isMounted && !silent) setLoading(false);
                });
        };

        // Debounce search to reduce API calls (400ms for responsive UX)
        debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchData((products || []).length > 0);
        }, 400);

        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [search, categoryFilter, shopRefresh.refreshTrigger]);

    // Fetch notifications (optimized - real-time event driven)
    useEffect(() => {
        if (!user) return;
        api.get('/customer/notifications').then(r => {
            setNotifications(r.data?.data || []);
            setUnreadCount(r.data?.unread || 0);
        }).catch(() => { });
    }, [user, notifRefresh.refreshTrigger]);

    // Fetch recommendations
    useEffect(() => {
        if (!user) return;
        setRecsLoading(true);
        api.get('/recommendations', { params: { limit: 8 } })
            .then(r => setRecommendations(r.data?.data || []))
            .catch(() => {})
            .finally(() => setRecsLoading(false));
    }, [user]);

    // Track product view when detail modal opens
    useEffect(() => {
        if (!selectedProduct?.id || !user) return;
        const viewStart = Date.now();
        api.post('/activity', {
            action: 'view',
            product_id: selectedProduct.id,
            category_id: selectedProduct.category_id || null,
        }).catch(() => {});
        // Log duration on close
        return () => {
            const seconds = Math.round((Date.now() - viewStart) / 1000);
            if (seconds >= 2) {
                api.post('/activity', {
                    action: 'view',
                    product_id: selectedProduct.id,
                    category_id: selectedProduct.category_id || null,
                    duration_seconds: seconds,
                }).catch(() => {});
            }
        };
    }, [selectedProduct?.id, user]);

    // Track search queries (debounced 2s after typing stops)
    useEffect(() => {
        if (!user || !search || search.length < 2) return;
        clearTimeout(searchLogTimerRef.current);
        searchLogTimerRef.current = setTimeout(() => {
            api.post('/search-log', {
                query: search,
                results_count: products.length,
            }).catch(() => {});
        }, 2000);
        return () => clearTimeout(searchLogTimerRef.current);
    }, [search, user]);

    // Track category clicks
    const handleCategoryClick = useCallback((catId) => {
        setCategoryFilter(catId);
        if (user && catId) {
            api.post('/activity', {
                action: 'category_click',
                category_id: catId,
            }).catch(() => {});
        }
    }, [user]);

    const markRead = () => {
        if (unreadCount > 0) {
            api.post('/customer/notifications/read').then(() => {
                markStale(STALE_KEYS.CUSTOMER_NOTIFICATIONS);
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
        markStale(STALE_KEYS.CUSTOMER_CART);
        setTimeout(() => setFlyingItem(null), 1000);
    };

    const handleBuyNow = (product) => {
        const saleInfo = getProductSaleInfo ? getProductSaleInfo(product) : null;
        const price = saleInfo && saleInfo.isOnSale ? saleInfo.salePrice : product.sell_price;
        const cartId = product.id;
        setCart(prev => {
            const updated = prev.map(i => ({ ...i, selectedForCheckout: false }));
            const existing = updated.find(i => i.cartId === cartId);
            if (existing) {
                return updated.map(i => i.cartId === cartId ? { ...i, qty: i.qty + 1, sell_price: price, selectedForCheckout: true } : i);
            }
            return [...updated, { ...product, sell_price: price, cartId, qty: 1, variantString: '', selectedVariants: {}, variant_id: null, selectedForCheckout: true }];
        });
        navigate('/shop/order');
    };

    const cartCount = cart.reduce((s, i) => s + i.qty, 0);

    return (
        <div className="min-h-screen bg-white">
            {/* ===== STICKY HEADER ===== */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="max-w-[1500px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/shop')}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm">H</div>
                        <div className="text-base font-bold text-gray-900">HRMS</div>
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 max-w-xl relative group hidden sm:block">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                        <Input 
                            type="text" 
                            placeholder="Search premium products..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 bg-gray-50 border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500/20 transition-all text-sm font-medium"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600">
                                <X className="h-full w-full" />
                            </button>
                        )}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                        {/* Cart */}
                        <Tooltip label="My Cart" position="bottom">
                            <Link to="/shop/cart" id="cart-icon-btn" className="relative h-10 w-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-orange-500 transition-all rounded-xl" aria-label="My Cart">
                                <ShoppingCart className="h-5 w-5" />
                                {cartCount > 0 && (
                                    <span id="cart-count-badge" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-orange-500 text-white text-xs font-black rounded-full px-1.5 shadow-lg shadow-orange-500/20 ring-2 ring-white">
                                        {cartCount}
                                    </span>
                                )}
                            </Link>
                        </Tooltip>

                        {/* Notifications */}
                        <div className="relative" ref={notifRef}>
                            <Tooltip label="Notifications" position="bottom">
                                <button
                                    type="button"
                                    className={`relative h-10 w-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-xl transition-all ${notifOpen ? 'bg-gray-50 text-orange-500' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setNotifOpen(prev => !prev); }}
                                    aria-label="Notifications"
                                >
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                                    )}
                                </button>
                            </Tooltip>
                            <NotificationPanel
                                notifications={notifications}
                                setNotifications={setNotifications}
                                unreadCount={unreadCount}
                                setUnreadCount={setUnreadCount}
                                isOpen={notifOpen}
                                onClose={() => setNotifOpen(false)}
                                apiPrefix="/customer/notifications"
                                markReadUrl="/customer/notifications/read"
                                renderMessage={(n) => n.data?.message || n.message || 'New notification'}
                                renderLabel={(n) => n.data?.title || 'HRMS'}
                                isRead={(n) => !!n.read_at}
                                onRefresh={() => {
                                    api.get('/customer/notifications').then(r => {
                                        setNotifications(r.data?.data || []);
                                        setUnreadCount(r.data?.unread || 0);
                                    }).catch(() => {});
                                }}
                                renderExtra={(n) => {
                                    const proofUrl = n.meta?.proof_url || n.data?.proof_url;
                                    if (!proofUrl) return null;
                                    return (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setProofModalUrl(proofUrl); setNotifOpen(false); }}
                                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
                                        >
                                            View Proof
                                        </button>
                                    );
                                }}
                            />
                        </div>

                        {/* My Orders */}
                        <Tooltip label="My Orders" position="bottom">
                            <Link to="/shop/history" className="hidden sm:flex items-center gap-1.5 h-10 px-3 text-gray-600 hover:bg-gray-50 hover:text-orange-500 transition-all rounded-xl text-sm font-semibold" aria-label="My Orders">
                                <ClipboardList className="h-4 w-4" />
                                <span>My Orders</span>
                            </Link>
                        </Tooltip>

                        {/* User Profile */}
                        <div className="relative ml-1" ref={profileRef}>
                            <Tooltip label="My Profile" position="bottom">
                                <button 
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                                    aria-label="My Profile"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-orange-500 overflow-hidden flex items-center justify-center text-white font-black text-xs shadow-lg shadow-orange-500/10 group-hover:scale-105 transition-transform">
                                        {user?.photo
                                            ? <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
                                            : user?.name?.charAt(0).toUpperCase()
                                        }
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 hidden lg:block">{user?.name?.split(' ')[0]}</span>
                                </button>
                            </Tooltip>

                            {profileOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden py-1.5 p-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="px-4 py-3 border-b border-gray-50 mb-1.5">
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Personal Account</p>
                                        <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                                    </div>
                                    <Link to="/shop/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-orange-500 transition-all rounded-xl">
                                        <Settings className="h-4 w-4" /> Settings
                                    </Link>
                                    <Link to="/shop/history" className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-orange-500 transition-all rounded-xl">
                                        <ClipboardList className="h-4 w-4" /> Order History
                                    </Link>
                                    <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 transition-all rounded-xl">
                                        <LogOut className="h-4 w-4" /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ===== MAIN CONTENT ===== */}
            <main className="max-w-[1500px] mx-auto px-6 py-6">
                {/* Featured Products Carousel */}
                <ProductCarousel
                    products={products}
                    setSelectedProduct={setSelectedProduct}
                    onAddToCart={addToCart}
                    onBuyNow={handleBuyNow}
                />

                {/* ===== RECOMMENDED FOR YOU ===== */}
                {recommendations.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-5 w-5 text-orange-500" />
                            <h2 className="text-lg font-black text-gray-900">Recommended for You</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {recommendations.map(p => (
                                <ProductCard
                                    key={'rec-' + p.id}
                                    product={p}
                                    onAddToCart={addToCart}
                                    setSelectedProduct={setSelectedProduct}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {recsLoading && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-5 w-5 text-gray-300" />
                            <div className="h-5 w-48 bg-gray-100 rounded animate-pulse"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="aspect-[1.1/1] bg-gray-100 rounded-2xl mb-3"></div>
                                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-50 rounded w-1/2"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Category Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <div className="flex gap-6 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => handleCategoryClick('')}
                            className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                !categoryFilter
                                    ? 'border-orange-500 text-orange-500'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            All Products
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryClick(cat.id)}
                                className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                    categoryFilter === cat.id
                                        ? 'border-orange-500 text-orange-500'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Catalog Header */}
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Product Catalog</h2>
                    <p className="text-sm text-gray-500">{products.filter(p => !recommendations.some(r => r.id === p.id)).length} items available</p>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="aspect-[1.1/1] bg-gray-100 rounded-2xl mb-4"></div>
                                <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-50 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <Search className="h-10 w-10 text-gray-200" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">No products found</h3>
                        <p className="text-sm text-gray-400 font-medium max-w-xs">Try broadening your search or switching categories.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {products.filter(p => !recommendations.some(r => r.id === p.id)).map(p => (
                            <ProductCard 
                                key={p.id} 
                                product={p} 
                                onAddToCart={addToCart} 
                                setSelectedProduct={setSelectedProduct}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Modals */}
            <ProductDetailModal 
                isOpen={!!selectedProduct}
                product={selectedProduct} 
                onClose={() => setSelectedProduct(null)} 
                onAddToCart={addToCart}
            />

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
            
            {/* Proof View Modal */}
            {proofModalUrl && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setProofModalUrl(null)}>
                    <div className="relative max-w-4xl w-full h-full flex flex-col items-center justify-center animate-in zoom-in duration-300">
                         <img 
                            src={proofModalUrl} 
                            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" 
                            alt="Proof" 
                            onClick={e => e.stopPropagation()}
                        />
                        <button 
                            className="mt-8 px-8 h-12 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-100"
                            onClick={() => setProofModalUrl(null)}
                        >
                            Close Preview
                        </button>
                    </div>
                </div>
            )}

            {/* Flying Item Animation Container */}
            {flyingItem && (
                <div className="fixed inset-0 pointer-events-none z-[9999]">
                    <div className="flying-item font-black text-xs text-orange-500">
                        +1 {flyingItem.name}
                    </div>
                </div>
            )}

            <style>{`
                .cart-bump { animation: cart-bump 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                @keyframes cart-bump {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.3); }
                    100% { transform: scale(1); }
                }
                .badge-pulse { animation: badge-pulse 0.4s ease-out; }
                @keyframes badge-pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 90, 31, 0.4); }
                    70% { transform: scale(1.15); box-shadow: 0 0 0 10px rgba(255, 90, 31, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 90, 31, 0); }
                }
                .flying-item {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    animation: flying-to-cart 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                    z-index: 9999;
                }
                @keyframes flying-to-cart {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
                    100% { 
                        opacity: 0; 
                        transform: translate(calc(100vw - 200px), -45vh) scale(0.2); 
                    }
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
