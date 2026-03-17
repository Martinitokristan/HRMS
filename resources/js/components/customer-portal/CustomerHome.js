import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProductDetailModal from './ProductDetailModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, X, ChevronRight } from 'lucide-react';

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
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);

    // Notifications
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notiOpen, setNotiOpen] = useState(false);

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

    // Fetch products
    useEffect(() => {
        setLoading(true);
        const params = { page: 1, per_page: 40 };
        if (search) params.search = search;
        if (categoryFilter) params.category_id = categoryFilter;
        axios.get('/products', { params })
            .then(r => { const d = r.data.data; setProducts(d.data ? d.data : d); })
            .finally(() => setLoading(false));
    }, [search, categoryFilter]);

    // Poll notifications
    useEffect(() => {
        if (!user) return;
        const fetchNoti = () => {
            axios.get('/customer/notifications').then(r => {
                setNotifications(r.data.data || []);
                setUnreadCount(r.data.unread || 0);
            }).catch(() => {});
        };
        fetchNoti();
        const interval = setInterval(fetchNoti, 10000);
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
        <div className="min-h-screen bg-[#fdfdfd]">
            {/* ===== STICKY HEADER ===== */}
            <header className="sticky top-0 z-50 bg-white border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => navigate('/shop')}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-white font-bold text-sm">H</div>
                        <div className="text-lg font-black text-foreground hidden sm:block">HRMS <span className="text-primary">Pro</span></div>
                    </div>

                    <div className="flex-1 max-w-lg relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={searchRef}
                            type="text"
                            placeholder="Find professional tools..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-8"
                        />
                        {search && (
                            <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')}>
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button id="cart-icon-btn" variant="default" size="icon" className="relative" onClick={() => navigate('/shop/cart')}>
                            <ShoppingCart className="h-4 w-4" />
                            {cartCount > 0 && <span id="cart-count-badge" className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">{cartCount}</span>}
                        </Button>

                        {user ? (
                            <div className="user-menu">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-white text-sm font-bold cursor-pointer">{user.name?.charAt(0)}</div>
                                <div className="user-dropdown">
                                    <Link to="/shop/history">My Orders</Link>
                                    <button onClick={() => { logout(); navigate('/'); }}>Sign Out</button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" asChild><Link to="/login">Sign In</Link></Button>
                        )}
                    </div>
                </div>
            </header>

            {/* ===== CATEGORY STRIP ===== */}
            <div className="border-b border-border bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
                    <Button
                        variant={!categoryFilter ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-full shrink-0"
                        onClick={() => setCategoryFilter('')}
                    >All Tools</Button>
                    {categories.map(c => (
                        <Button
                            key={c.id}
                            variant={categoryFilter == c.id ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-full shrink-0"
                            onClick={() => setCategoryFilter(categoryFilter == c.id ? '' : c.id)}
                        >{c.name}</Button>
                    ))}
                </div>
            </div>

            {/* ===== PRODUCT GRID ===== */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground">{categoryFilter ? categories.find(c => c.id == categoryFilter)?.name || 'Products' : 'Hardware Catalog'}</h2>
                    <span className="text-sm text-muted-foreground font-medium">{products.length} Professional Items</span>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => (
                            <Card key={i} className="overflow-hidden animate-pulse">
                                <div className="aspect-[1.1] bg-secondary" />
                                <div className="p-5 space-y-3">
                                    <div className="h-3 bg-secondary rounded w-2/5" />
                                    <div className="h-4 bg-secondary rounded w-4/5" />
                                    <div className="flex justify-between">
                                        <div className="h-5 bg-secondary rounded w-1/3" />
                                        <div className="h-9 w-9 bg-secondary rounded-xl" />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <Card className="text-center py-16 px-8">
                        <div className="text-5xl mb-4">🔧</div>
                        <h3 className="text-lg font-bold text-foreground mb-2">No equipment found</h3>
                        <p className="text-sm text-muted-foreground mb-6">We couldn't find any products matching your specific hardware requirements.</p>
                        <Button onClick={() => { setSearch(''); setCategoryFilter(''); }}>Reset Catalog</Button>
                    </Card>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {products.map(p => {
                            const totalVariantStock = p.product_variants?.reduce((s, v) => s + (v.stock || 0), 0) || 0;
                            const inStock = p.product_variants?.length > 0 ? totalVariantStock > 0 : (p.inventory?.current_stock || 0) > 0;
                            const imgSrc = p.image_path ? `/storage/${p.image_path}` : null;
                            const hasVariants = p.product_variants?.length > 0;

                            return (
                                <Card key={p.id} className="pcard overflow-hidden cursor-pointer group transition-all hover:shadow-lg hover:-translate-y-0.5" onClick={() => setSelectedProduct(p)}>
                                    <div className="pcard__img aspect-[1.1] bg-secondary flex items-center justify-center relative overflow-hidden">
                                        {imgSrc
                                            ? <img src={imgSrc} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                            : <div className="text-5xl opacity-20">🏗️</div>
                                        }
                                        {!inStock && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Badge variant="destructive" className="text-xs font-bold">SOLD OUT</Badge></div>}
                                    </div>
                                    <div className="p-4">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">{p.category?.name || 'Supply'}</div>
                                        <div className="font-bold text-foreground text-sm mb-3 line-clamp-2">{p.name}</div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-lg font-black text-foreground">₱{Number(p.sell_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            <Button
                                                size="icon"
                                                className="h-9 w-9 rounded-xl"
                                                disabled={!inStock}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const img = e.currentTarget.closest('.pcard').querySelector('.pcard__img');
                                                    const cartBtn = document.getElementById('cart-icon-btn');
                                                    if (img && cartBtn) {
                                                        const s = img.getBoundingClientRect();
                                                        const d = cartBtn.getBoundingClientRect();
                                                        setFlyingItem({
                                                            id: p.id, img: imgSrc,
                                                            startX: s.left + s.width / 2, startY: s.top + s.height / 2,
                                                            endX: d.left + d.width / 2, endY: d.top + d.height / 2,
                                                        });
                                                        setTimeout(() => setFlyingItem(null), 800);
                                                    }
                                                    if (hasVariants) {
                                                        const first = p.product_variants.find(v => (v.stock || 0) > 0);
                                                        if (first) {
                                                            addToCart(p, {
                                                                variant_id: first.id,
                                                                price: first.price_override || p.sell_price,
                                                                variants: { Size: first.size_value, Color: first.color_value, Weight: first.weight_value }
                                                            });
                                                        }
                                                    } else {
                                                        addToCart(p);
                                                    }
                                                }}
                                            >
                                                +
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>

            <ProductDetailModal
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                product={selectedProduct}
                onAddToCart={addToCart}
            />

            {/* Flying Item Animation */}
            {flyingItem && (
                <div className="flying-item" style={{
                    '--start-x': `${flyingItem.startX}px`, '--start-y': `${flyingItem.startY}px`,
                    '--end-x': `${flyingItem.endX}px`, '--end-y': `${flyingItem.endY}px`,
                }}>
                    {flyingItem.img ? <img src={flyingItem.img} alt="" /> : '🛠️'}
                </div>
            )}
        </div>
    );
}
