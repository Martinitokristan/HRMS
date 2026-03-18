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

// Optimized: Memoized product card to prevent unnecessary re-renders
const ProductCard = React.memo(({ product, onAddToCart, setSelectedProduct }) => {
    const allVariants = product.product_variants || [];
    const hasVariants = allVariants.length > 0;
    const totalVariantStock = allVariants.reduce((s, v) => s + Number(v.stock || 0), 0);
    const baseStock = Number(product.inventory?.current_stock || 0);
    
    const inStock = hasVariants ? (totalVariantStock > 0 || baseStock > 0) : baseStock > 0;
    const imgSrc = product.image_path ? `/storage/${product.image_path}` : null;

    // Calculate sale information
    const saleInfo = getProductSaleInfo(product);

    const colorMap = {};
    allVariants.forEach(v => { if (v.color_value) colorMap[v.color_value_id] = v.color_value; });
    const colors = Object.values(colorMap);

    const sizeMap = {};
    allVariants.forEach(v => { if (v.size_value) sizeMap[v.size_value_id] = v.size_value; });
    const sizes = Object.values(sizeMap);

    const handleAddToCart = (e) => {
        e.stopPropagation();
        console.log('Button clicked:', product.name, 'hasVariants:', hasVariants);
        if (hasVariants) {
            console.log('Setting selectedProduct from button:', product.name);
            setSelectedProduct(product);
        } else {
            onAddToCart(product, {
                qty: 1,
                variants: {},
                price: saleInfo.isOnSale ? saleInfo.salePrice : product.sell_price,
                saleInfo: saleInfo,
                variant_id: null,
                isUpdate: !!product.cartId
            });
        }
    };

    return (
        <div 
            className="pcard group bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-lg"
            onClick={() => {
                console.log('DIV clicked:', product.name);
                if (hasVariants) {
                    console.log('Setting selectedProduct:', product.name);
                    setSelectedProduct(product);
                } else {
                    onAddToCart(product, {
                        qty: 1,
                        variants: {},
                        price: saleInfo.isOnSale ? saleInfo.salePrice : product.sell_price,
                        saleInfo: saleInfo,
                        variant_id: null,
                        isUpdate: !!product.cartId
                    });
                }
            }}
        >
            {/* Product Image */}
            <div className="pcard__img relative aspect-square bg-gray-50 overflow-hidden">
                {imgSrc
                    ? <img src={imgSrc} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="h-16 w-16 text-gray-300 opacity-40" /></div>
                }
                {!inStock && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded">Coming Soon</span>
                    </div>
                )}
                {product.category?.name && (
                    <div className="absolute top-2 left-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-white/95 text-gray-700 px-2 py-1 rounded shadow-sm">
                            {product.category.name}
                        </span>
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2 leading-tight">{product.name}</h3>

                {product.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">{product.description}</p>
                )}

                {/* Stock */}
                <div className="text-xs text-gray-600 mb-2">
                    {inStock ? (
                        <span className="text-green-600 font-medium">
                            Stock: {hasVariants ? `${totalVariantStock} units (variants)` : `${baseStock} units`}
                        </span>
                    ) : (
                        <span className="text-red-600 font-medium">Out of Stock</span>
                    )}
                </div>

                {/* Price with Sale Display */}
                <div className="mb-4">
                    {saleInfo.isOnSale ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="destructive" className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600">
                                    <Percent className="w-3 h-3 mr-1" />
                                    SALE
                                </Badge>
                                <span className="text-xs text-red-600 font-semibold">
                                    -{saleInfo.salePercentage}%
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-red-600">
                                    ₱{saleInfo.salePrice.toFixed(2)}
                                </span>
                                <span className="text-sm text-gray-400 line-through">
                                    ₱{saleInfo.originalPrice.toFixed(2)}
                                </span>
                            </div>
                            <div className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded inline-block">
                                Save ₱{saleInfo.savings.toFixed(2)}
                            </div>
                        </div>
                    ) : (
                        <div className="text-lg font-bold text-gray-900">
                            ₱{saleInfo.originalPrice.toFixed(2)}
                        </div>
                    )}
                </div>

                {/* Add to Cart Button */}
                <button
                    className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                    disabled={!inStock}
                    onClick={handleAddToCart}
                >
                    🛒 {hasVariants ? 'View Options' : 'Add to Cart'}
                </button>
            </div>
        </div>
    );
});

export default function CustomerHome() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [cart, setCart] = useState([]);
    const [flyingItem, setFlyingItem] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    // Notifications
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Load cart from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('hrms_cart');
        if (saved) try { setCart(JSON.parse(saved)); } catch (e) {}
    }, []);

    useEffect(() => { localStorage.setItem('hrms_cart', JSON.stringify(cart)); }, [cart]);

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

    // Fetch categories
    useEffect(() => { axios.get('/categories').then(r => setCategories(r.data.data || [])).catch(() => {}); }, []);

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch products with debouncing
    useEffect(() => {
        let isMounted = true;
        let debounce;

        const fetch = () => {
            setLoading(true);
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
                        const d = r.data.data; 
                        setProducts(d.data ? d.data : d); 
                    }
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        };

        // Debounce search to reduce API calls (400ms for responsive UX)
        debounce = setTimeout(fetch, 400);

        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [search, categoryFilter]);

    // Fetch notifications (optimized - only fetch when needed)
    useEffect(() => {
        if (!user) return;
        axios.get('/customer/notifications').then(r => {
            setNotifications(r.data.data || []);
            setUnreadCount(r.data.unread || 0);
        }).catch(() => {});
    }, [user]);

    const markRead = () => {
        if (unreadCount > 0) {
            axios.post('/customer/notifications/read').then(() => {
                setUnreadCount(0);
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            });
        }
    };

    const addToCart = (product, options = {}) => {
        const qty = options.qty || 1;
        const variants = options.variants || {};
        const price = options.price || product.sell_price;
        const variant_id = options.variant_id || null;
        const isUpdate = options.isUpdate || false;
        const variantLabels = Object.values(variants).filter(Boolean).map(v => v.label);
        const variantString = variantLabels.join(', ');
        const cartId = variantString ? `${product.id}-${variantString}` : product.id;

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
    };

    const cartCount = cart.reduce((s, i) => s + i.qty, 0);

    return (
        <div className="min-h-screen bg-white">
            {/* ===== STICKY HEADER ===== */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/shop')}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white font-bold text-sm">H</div>
                        <div className="text-base font-bold text-gray-900">HRMS <span className="font-normal text-gray-600">Pro</span></div>
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
                    <div className="flex items-center gap-4 shrink-0">
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
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        <button
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                                !categoryFilter 
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
                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                                    categoryFilter == c.id 
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
            <main className="max-w-7xl mx-auto px-6 py-6">
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900">
                        {categoryFilter ? categories.find(c => c.id == categoryFilter)?.name || 'Products' : 'Product Catalog'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{products.length} items available</p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
                                <div className="aspect-square bg-gray-100" />
                                <div className="p-4 space-y-3">
                                    <div className="h-3 bg-gray-100 rounded w-2/5" />
                                    <div className="h-4 bg-gray-100 rounded w-4/5" />
                                    <div className="h-8 bg-gray-100 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-20 px-8 bg-white border border-gray-200 rounded-lg">
                        <Package className="h-12 w-12 mx-auto mb-4 text-gray-400 opacity-30" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No products found</h3>
                        <p className="text-sm text-gray-500 mb-6">Try adjusting your search or category filter.</p>
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => { setSearch(''); setCategoryFilter(''); }}>Clear Filters</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {products.map(p => (
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

            {/* Add a simple debug log to see if modal is being called */}
            <ProductDetailModal
                key={selectedProduct?.id || 'modal'}
                isOpen={!!selectedProduct}
                onClose={() => {
                    console.log('Modal closing, selectedProduct:', selectedProduct?.name);
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
        </div>
    );
}
