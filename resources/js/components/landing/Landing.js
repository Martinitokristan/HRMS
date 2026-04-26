import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { silentApi } from "../../lib/api";
import {
    Package, ShieldCheck, Truck, Wrench, ShoppingCart, ArrowRight,
    X, Headphones, RefreshCw, Wallet, Zap, Hammer, Ruler,
    Paintbrush, Scissors, Settings, Box, Layers, Star, Send, CheckCircle, Menu, ChevronDown
} from "lucide-react";
import { GCashIcon } from "@/components/icons/PaymentIcons";
import { cn, formatPHP } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const BENEFITS = [
    { icon: Truck,      title: 'Express Delivery',   desc: 'Fast and reliable delivery to your site or home.' },
    { icon: GCashIcon,  title: 'GCash Payment',       desc: 'Pay using GCash for fast and secure digital transactions.' },
    { icon: RefreshCw,  title: 'Hassle Free Returns', desc: 'Easy returns within 7 days of purchase.' },
    { icon: Headphones, title: 'Online Support',      desc: '24/7 customer support for all your queries.' },
];

const RatingStars = ({ rating }) => (
    <div className="flex gap-0.5">
        {[1,2,3,4,5].map(s => (
            <Star key={s} className={cn("h-3.5 w-3.5", s <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200")} />
        ))}
    </div>
);


const CATEGORY_ICON_MAP = [
    { match: ['power', 'electric', 'drill'],             icon: Zap },
    { match: ['hand', 'tool', 'manual'],                 icon: Hammer },
    { match: ['measur', 'ruler', 'level', 'tape'],       icon: Ruler },
    { match: ['paint', 'brush', 'coat', 'finish'],       icon: Paintbrush },
    { match: ['cut', 'saw', 'blade', 'cutter'],          icon: Scissors },
    { match: ['fasten', 'screw', 'bolt', 'nail', 'nut'], icon: Settings },
    { match: ['stor', 'box', 'cabinet', 'shelv', 'rack'],icon: Box },
    { match: ['safe', 'protect', 'gear', 'glove', 'ppe'],icon: ShieldCheck },
];

const getCategoryIcon = (name = '') => {
    const n = name.toLowerCase();
    const found = CATEGORY_ICON_MAP.find(({ match }) => match.some(m => n.includes(m)));
    return found ? found.icon : Layers;
};


const LandingProductCard = ({ product, onLoginPrompt }) => {
    const imgSrc = product.image_path ? `/storage/${product.image_path}` : null;
    const originalPrice = Number(product.sell_price || 0);
    const salePrice = product.sale_price ? Number(product.sale_price) : null;
    const isOnSale = salePrice && salePrice < originalPrice;
    const saleAmt = isOnSale ? Math.round((1 - salePrice / originalPrice) * 100) : 0;
    const displayPrice = isOnSale ? salePrice : originalPrice;

    return (
        <div
            className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-xl hover:shadow-gray-200/60 hover:-translate-y-1 max-w-[280px]"
            onClick={onLoginPrompt}
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-50 border-b border-gray-100">
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Wrench className="h-10 w-10 text-gray-200" />
                    </div>
                )}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                    <span className="bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-lg shadow-orange-500/20">
                        {product.category?.name || 'Hardware'}
                    </span>
                    {isOnSale && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg shadow-red-500/20">
                            SALE -{saleAmt}%
                        </span>
                    )}
                </div>
            </div>
            <div className="p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-900 leading-tight group-hover:text-orange-500 transition-colors line-clamp-2">{product.name}</h3>
                {product.brand?.name && (
                    <p className="text-xs text-orange-500 font-semibold leading-none">{product.brand.name}</p>
                )}
                <p className="text-xs text-gray-500 leading-normal line-clamp-2 font-medium">
                    {product.description || 'Premium quality hardware for any construction or repair project.'}
                </p>
                <div className="flex items-end gap-2 pt-1">
                    <span className="text-base font-bold text-orange-500 leading-none">
                        ₱{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {isOnSale && (
                        <span className="text-xs text-gray-400 line-through font-bold leading-none mb-0.5">
                            ₱{originalPrice.toFixed(2)}
                        </span>
                    )}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onLoginPrompt(); }}
                    className="w-full h-8 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">Login to Shop</span>
                </button>
            </div>
        </div>
    );
};

export default function Landing() {
    const navigate = useNavigate();
    const [popularProducts, setPopularProducts]   = useState([]);
    const [saleProducts, setSaleProducts]         = useState([]);
    const [categoryProducts, setCategoryProducts] = useState([]);
    const [categories, setCategories]             = useState([]);
    const [loading, setLoading]                   = useState(true);
    const [categoryLoading, setCategoryLoading]   = useState(false);
    const [notification, setNotification]         = useState(false);
    const [activeCategory, setActiveCategory]     = useState('');
    const [email, setEmail]                       = useState('');
    const [categorySearch, setCategorySearch]     = useState('');
    const [bestSellers, setBestSellers]           = useState([]);
    const [testimonials, setTestimonials]         = useState([]);
    const [mobileMenuOpen, setMobileMenuOpen]     = useState(false);
    const [desktopNavOpen, setDesktopNavOpen]     = useState(false);
    const [newsletterSuccess, setNewsletterSuccess] = useState(false);
    const [newsletterError, setNewsletterError] = useState('');
    const navCloseTimeoutRef = useRef(null);

    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            if (!mounted) return;
            setLoading(true);
            try {
                const [prodRes, catRes] = await Promise.all([
                    silentApi.get('/products', { params: { per_page: 30 } }),
                    silentApi.get('/categories').catch(() => ({ data: { data: [] } })),
                ]);
                if (!mounted) return;
                const pd = prodRes.data.data;
                const prods = Array.isArray(pd) ? pd : (pd?.data || []);

                const byRating = [...prods].sort((a, b) => (Number(b.average_rating) || 0) - (Number(a.average_rating) || 0));
                setPopularProducts(byRating.slice(0, 8));

                const onSale = prods.filter(p => p.sale_price && Number(p.sale_price) < Number(p.sell_price));
                setSaleProducts(onSale.slice(0, 4));

                const [bsRes, revRes] = await Promise.allSettled([
                    silentApi.get('/products/best-sellers', { params: { limit: 4 } }),
                    silentApi.get('/reviews/public', { params: { per_page: 3 } }),
                ]);
                if (!mounted) return;
                if (bsRes.status === 'fulfilled') {
                    const bd = bsRes.value.data?.data;
                    setBestSellers(Array.isArray(bd) ? bd : (bd?.data || []));
                }
                if (revRes.status === 'fulfilled') {
                    const rd = revRes.value.data?.data;
                    setTestimonials(Array.isArray(rd) ? rd : (rd?.data || []));
                }

                const cd = catRes.data?.data;
                const cats = Array.isArray(cd) ? cd : (cd?.data || []);
                setCategories(cats);
                if (cats.length > 0) setActiveCategory(String(cats[0].id));
            } catch {
                // keep existing data on background error
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!activeCategory || isNaN(Number(activeCategory))) {
            setCategoryProducts([]);
            return;
        }
        let mounted = true;
        setCategoryLoading(true);
        silentApi.get('/products', { params: { category_id: activeCategory, per_page: 6 } })
            .then(res => {
                if (!mounted) return;
                const d = res.data.data;
                setCategoryProducts(Array.isArray(d) ? d : (d?.data || []));
            })
            .catch(() => { if (mounted) setCategoryProducts([]); })
            .finally(() => { if (mounted) setCategoryLoading(false); });
        return () => { mounted = false; };
    }, [activeCategory]);

    const triggerLoginNotice = () => {
        setNotification(true);
        setTimeout(() => setNotification(false), 2000);
    };

    const openDesktopMenu = () => {
        if (navCloseTimeoutRef.current) {
            clearTimeout(navCloseTimeoutRef.current);
            navCloseTimeoutRef.current = null;
        }
        setDesktopNavOpen(true);
    };

    const closeDesktopMenuSoon = () => {
        navCloseTimeoutRef.current = setTimeout(() => {
            setDesktopNavOpen(false);
        }, 120);
    };

    const scrollToCategories = () => {
        const el = document.getElementById('categories');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const STATIC_CATS = [
        { id: 'power',   name: 'Power Tools', icon: Zap },
        { id: 'hand',    name: 'Hand Tools',  icon: Hammer },
        { id: 'measur',  name: 'Measuring',   icon: Ruler },
        { id: 'paint',   name: 'Paint',       icon: Paintbrush },
        { id: 'cutting', name: 'Cutting',     icon: Scissors },
        { id: 'fasten',  name: 'Fasteners',   icon: Settings },
        { id: 'storage', name: 'Storage',     icon: Box },
        { id: 'safety',  name: 'Safety Gear', icon: ShieldCheck },
    ];

    const displayCats = categories.length > 0
        ? categories.map(c => ({ ...c, id: String(c.id), icon: getCategoryIcon(c.name) }))
        : STATIC_CATS;

    const FILL_PROMOS = [
        { gradient: 'from-gray-800 to-gray-900',    icon: Hammer,      title: '15% Off', sub: 'on Woodworking Tools' },
        { gradient: 'from-orange-600 to-red-700',   icon: Zap,         title: '25% Off', sub: 'on Power Tools' },
        { gradient: 'from-gray-700 to-gray-900',    icon: Wrench,      title: '18% Off', sub: 'on Hand Tools' },
        { gradient: 'from-orange-500 to-amber-600', icon: ShieldCheck, title: '20% Off', sub: 'on Safety Gear' },
    ];

    return (
        <div className="min-h-screen bg-white">

            {/* ── Login notice toast ── */}
            <div
                className={cn(
                    "fixed left-1/2 -translate-x-1/2 z-[9999] transition-all duration-500 ease-out",
                    "flex items-center gap-3 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl border border-white/10 min-w-[300px] justify-center cursor-pointer",
                    notification ? "top-6 opacity-100" : "-top-24 opacity-0"
                )}
                onClick={() => navigate('/login')}
            >
                <ShieldCheck className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-bold">Please <span className="text-orange-500 underline">sign in</span> to shop</span>
                <button className="ml-1 h-5 w-5 flex items-center justify-center text-white/50 hover:text-white" onClick={(e) => { e.stopPropagation(); setNotification(false); }}>
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* ── NAV ── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200 shadow-sm">
                <div className="w-full mx-auto px-4 md:px-6 lg:px-8 xl:px-10 flex items-center justify-between h-16">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
                            <span className="text-xs font-black text-white">H</span>
                        </div>
                        <span className="text-lg font-black text-gray-900">HRMS</span>
                    </div>
                    <div className="hidden lg:flex items-center gap-2">
                        {[
                            { href: '#hero',       label: 'HOME' },
                            { href: '#categories', label: 'CATEGORIES' },
                            { href: '#products',   label: 'PRODUCTS' },
                        ].map(({ href, label }) => (
                            <a
                                key={href}
                                href={href}
                                className="px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide text-gray-600 hover:bg-orange-50 hover:text-orange-500 transition-colors whitespace-nowrap"
                            >
                                {label}
                            </a>
                        ))}

                        <div
                            className="relative"
                            onMouseEnter={openDesktopMenu}
                            onMouseLeave={closeDesktopMenuSoon}
                        >
                            <button
                                type="button"
                                onClick={() => setDesktopNavOpen(v => !v)}
                                className="px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide text-gray-600 hover:bg-orange-50 hover:text-orange-500 transition-colors whitespace-nowrap flex items-center gap-1"
                            >
                                MORE
                                <ChevronDown className={cn("h-4 w-4 transition-transform", desktopNavOpen ? "rotate-180" : "")} />
                            </button>
                            {desktopNavOpen && (
                                <div
                                    className="absolute left-0 top-[calc(100%+6px)] w-44 rounded-xl border border-gray-200 bg-white shadow-lg py-1 z-50"
                                    onMouseEnter={openDesktopMenu}
                                    onMouseLeave={closeDesktopMenuSoon}
                                >
                                    {[
                                        { href: '#deals', label: 'BEST SELLERS' },
                                        { href: '#benefits', label: 'BENEFITS' },
                                        { href: '#testimonials', label: 'FEEDBACK' },
                                        { href: '#newsletter', label: 'NEWSLETTER' },
                                    ].map(({ href, label }) => (
                                        <a
                                            key={href}
                                            href={href}
                                            onClick={() => setDesktopNavOpen(false)}
                                            className="block px-4 py-2 text-sm font-medium uppercase tracking-wide text-gray-600 hover:bg-orange-50 hover:text-orange-500"
                                        >
                                            {label}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" className="font-semibold text-gray-600 hidden sm:flex" asChild><Link to="/login">Sign In</Link></Button>
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/20 hidden sm:flex" asChild>
                            <Link to="/register">Create Account</Link>
                        </Button>
                        <button className="lg:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                            <Menu className="h-6 w-6 text-gray-700" />
                        </button>
                    </div>
                </div>
                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="lg:hidden bg-white border-t border-gray-200">
                        <div className="px-6 py-4 space-y-3">
                            {[
                                { href: '#hero',         label: 'HOME' },
                                { href: '#categories',   label: 'CATEGORIES' },
                                { href: '#products',     label: 'PRODUCTS' },
                                { href: '#deals',        label: 'BEST SELLERS' },
                                { href: '#benefits',     label: 'BENEFITS' },
                                { href: '#testimonials', label: 'FEEDBACK' },
                                { href: '#newsletter',   label: 'NEWSLETTER' },
                            ].map(({ href, label }) => (
                                <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-semibold text-gray-600 hover:text-orange-500 transition-colors">
                                    {label}
                                </a>
                            ))}
                            <div className="pt-3 border-t border-gray-100 space-y-2">
                                <Button variant="ghost" className="w-full font-semibold text-gray-600" asChild><Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link></Button>
                                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/20" asChild>
                                    <Link to="/register" onClick={() => setMobileMenuOpen(false)}>Create Account</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* ── SECTION 1: HERO ── */}
            <header id="hero" className="relative pt-16 overflow-hidden">
                <div className="absolute inset-0 bg-gray-100/70" />
                <div className="w-full max-w-[1400px] mx-auto px-6 md:px-10 py-12 md:py-16 relative">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                        <div className="max-w-2xl">
                            <p className="text-orange-500 font-black uppercase tracking-[0.2em] text-xs mb-4">
                                Your Trusted Hardware Store
                            </p>
                            <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-black text-gray-900 leading-[1.06] tracking-tight mb-5">
                                For All Your Home and<br />Hardware Needs
                            </h1>
                            <p className="text-base text-gray-600 max-w-xl leading-relaxed mb-8">
                                Shop the widest selection of hardware, tools, and supplies for your construction, repair, and home improvement projects.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <Button size="lg" className="h-12 px-8 bg-gray-900 text-white hover:bg-gray-800 font-bold text-sm shadow-lg" onClick={triggerLoginNotice}>
                                    <ShoppingCart className="h-4 w-4" /> Explore Products
                                </Button>
                                <Button size="lg" className="h-12 px-8 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/30" asChild>
                                    <Link to="/supplier/register">Partner with Us <ArrowRight className="h-4 w-4" /></Link>
                                </Button>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-200/70 overflow-hidden">
                                <div className="relative bg-gray-100">
                                    <img
                                        src="/LandingImage.png"
                                        alt="Hardware tools and supplies"
                                        className="w-full h-[300px] md:h-[360px] object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/15" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce z-20">
                    <button
                        type="button"
                        onClick={scrollToCategories}
                        aria-label="Scroll to categories"
                        className="h-10 w-10 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200/60 transition-colors"
                    >
                        <ChevronDown className="h-8 w-8" />
                    </button>
                </div>
            </header>

            {/* ── SECTION 2: EXPLORE BY CATEGORY ── */}
            <section id="categories" className="py-12 md:py-16">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="text-center mb-10">
                        <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-1">Browse</p>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">Explore by Category</h2>
                    </div>
                    <div className="space-y-6">
                        {/* Category pills (horizontal, centered) */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {displayCats
                                .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                .map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCategory(String(cat.id))}
                                        className={cn(
                                            "px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
                                            activeCategory === String(cat.id)
                                                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                                                : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-500"
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            <Button
                                variant="outline"
                                className="border-orange-500 text-orange-500 hover:bg-orange-50 font-bold text-xs h-8 px-4 rounded-full"
                                onClick={triggerLoginNotice}
                            >
                                All Categories <ArrowRight className="h-3 w-3" />
                            </Button>
                        </div>

                        {/* Centered product grid */}
                        {(categories.length > 0 ? categoryLoading : loading) ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="animate-pulse">
                                        <div className="aspect-[4/3] bg-gray-100 rounded-xl mb-3" />
                                        <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                                        <div className="h-3 bg-gray-50 rounded w-1/2" />
                                    </div>
                                ))}
                            </div>
                        ) : (categories.length > 0 ? categoryProducts : popularProducts.slice(0, 6)).length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed border-gray-200 text-center max-w-2xl mx-auto">
                                <Package className="h-10 w-10 text-gray-200 mb-2" />
                                <p className="text-sm text-gray-400 font-medium">No products in this category yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
                                {(categories.length > 0 ? categoryProducts : popularProducts.slice(0, 6)).map(p => (
                                    <LandingProductCard key={p.id} product={p} onLoginPrompt={triggerLoginNotice} />
                                ))}
                            </div>
                        )}

                        {/* Optional category search (mobile + desktop) */}
                        <div className="max-w-sm mx-auto pt-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={categorySearch}
                                    onChange={e => setCategorySearch(e.target.value)}
                                    placeholder="Search categories..."
                                    className="w-full h-9 pl-9 pr-3 rounded-full border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                                />
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION 3: POPULAR PRODUCTS ── */}
            <section id="products" className="py-12 md:py-16">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="text-center mb-10">
                        <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-1">Top Rated</p>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">Popular Products</h2>
                    </div>
                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="aspect-[4/3] bg-gray-200 rounded-2xl mb-3" />
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : popularProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Package className="h-14 w-14 text-gray-200 mb-4" />
                            <p className="text-gray-400 font-medium">No products available yet. Check back soon!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {popularProducts.map(p => <LandingProductCard key={p.id} product={p} onLoginPrompt={triggerLoginNotice} />)}
                        </div>
                    )}
                    <div className="text-center mt-10">
                        <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/20 h-12 px-10" onClick={triggerLoginNotice}>
                            Explore all items <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* ── SECTION 4: BEST SELLERS ── */}
            <section id="deals" className="py-12 md:py-16">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="rounded-2xl bg-orange-500 p-8 md:p-12 text-white order-2 md:order-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-orange-200 mb-3">Top Selling</p>
                            <h2 className="text-3xl md:text-4xl font-black leading-tight mb-4">Our Best Sellers<br />— Loved by Customers</h2>
                            <p className="text-sm text-orange-100 leading-relaxed mb-5 font-medium">These are the most purchased products by our customers. Trusted quality, proven performance.</p>
                            {bestSellers.length > 0 && (() => {
                                const avg = bestSellers.reduce((s, p) => s + Number(p.average_rating || 0), 0) / bestSellers.length;
                                return (
                                    <div className="flex items-center gap-3 mb-6">
                                        <RatingStars rating={Math.round(avg)} />
                                        <span className="text-xs text-orange-200 font-semibold">Avg {avg.toFixed(1)}/5 from verified buyers</span>
                                    </div>
                                );
                            })()}
                            <Button size="lg" className="bg-white text-orange-500 hover:bg-gray-100 font-black h-11 px-7 text-sm" onClick={triggerLoginNotice}>
                                Shop Best Sellers <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 order-1 md:order-2">
                            {(bestSellers.length > 0 ? bestSellers : FILL_PROMOS).map((item, idx) => {
                                const isReal = bestSellers.length > 0 && idx < bestSellers.length;
                                if (isReal) {
                                    const p = item;
                                    const img = p.image_path ? `/storage/${p.image_path}` : null;
                                    const Icon = getCategoryIcon(p.category?.name || '');
                                    const isOnSale = p.sale_price && Number(p.sale_price) < Number(p.sell_price);
                                    return (
                                        <div key={p.id} className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer group" onClick={triggerLoginNotice}>
                                            {img
                                                ? <img src={img} alt={p.name} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-65 transition-opacity" />
                                                : <div className="absolute inset-0 flex items-center justify-center"><Icon className="h-12 w-12 text-white/20" /></div>
                                            }
                                            {isOnSale && (
                                                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                                    SALE
                                                </span>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                                <p className="text-xs font-black text-white line-clamp-1">{p.name}</p>
                                                <p className="text-xs text-orange-300 font-mono font-bold">{formatPHP(p.sale_price || p.sell_price)}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                const { gradient, icon: Icon, title, sub } = item;
                                return (
                                    <div key={title} className={`relative bg-gradient-to-br ${gradient} rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer flex items-center justify-center group`} onClick={triggerLoginNotice}>
                                        <Icon className="h-12 w-12 text-white/20 group-hover:text-white/30 transition-colors" />
                                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/40">
                                            <p className="text-sm font-black text-white">{title}</p>
                                            <p className="text-xs text-gray-300">{sub}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION 5: BENEFITS FOR YOUR EXPERIENCE ── */}
            <section id="benefits" className="py-12 md:py-16 bg-gray-100">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="text-center mb-10">
                        <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-1">Why Choose Us</p>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">Benefits for your experience</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {BENEFITS.map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="flex flex-col items-center text-center gap-3 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 border-2 border-orange-100">
                                    <Icon className="h-7 w-7 text-orange-500" />
                                </div>
                                <p className="text-sm font-black text-gray-900">{title}</p>
                                <p className="text-xs text-gray-500 leading-relaxed font-medium">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── SECTION 6: CUSTOMER FEEDBACK ── */}
            <section id="testimonials" className="py-12 md:py-16 bg-white">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="text-center mb-10">
                        <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-1">Customer Feedback</p>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">What Our Customers Say</h2>
                    </div>
                    {testimonials.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Star className="h-12 w-12 text-gray-200 mb-3" />
                            <p className="text-gray-400 font-medium">No customer reviews yet. Be the first to shop and share your experience!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {testimonials.map((review) => {
                                const name = review.customer?.name || 'Customer';
                                const text = review.review_text || review.title || '';
                                const rating = Number(review.rating || 0);
                                const productName = review.product?.name || '';
                                return (
                                    <div key={review.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md flex flex-col gap-3">
                                        <RatingStars rating={rating} />
                                        {text && <p className="text-sm text-gray-600 leading-relaxed flex-1 font-medium">"{text}"</p>}
                                        {productName && (
                                            <p className="text-xs text-orange-500 font-bold uppercase tracking-wide">re: {productName}</p>
                                        )}
                                        <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                                            <div className="h-9 w-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                                                {name[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-gray-900">{name}</p>
                                                {review.is_verified_purchase && (
                                                    <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                                        <CheckCircle className="h-3 w-3" /> Verified Purchase
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ── SECTION 7: NEWSLETTER ── */}
            <section id="newsletter" className="py-12 md:py-16 bg-gray-900">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10 text-center">
                    <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-3">Stay Updated</p>
                    <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Join Our Newsletter</h2>
                    <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto font-medium">Get the latest hardware deals, new arrivals, and exclusive offers delivered to your inbox.</p>
                    {newsletterSuccess ? (
                        <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <p className="text-sm text-white font-semibold">Thanks! We'll be in touch.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 max-w-md mx-auto">
                            <div className="flex gap-3">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setNewsletterError(''); }}
                                    placeholder="Enter your email address"
                                    className="flex-1 h-11 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-gray-500 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                                <Button className="h-11 px-6 bg-orange-500 hover:bg-orange-600 text-white font-bold shrink-0" onClick={() => {
                                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                    if (!email.trim()) {
                                        setNewsletterError('Please enter your email');
                                    } else if (!emailRegex.test(email)) {
                                        setNewsletterError('Please enter a valid email');
                                    } else {
                                        setNewsletterSuccess(true);
                                        setEmail('');
                                    }
                                }}>
                                    <Send className="h-4 w-4" /> Subscribe
                                </Button>
                            </div>
                            {newsletterError && <p className="text-xs text-red-400">{newsletterError}</p>}
                        </div>
                    )}
                    <p className="text-xs text-gray-600 mt-3">No spam, unsubscribe anytime.</p>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer id="about" className="bg-gray-900 border-t border-white/5 text-white py-12 px-6 md:px-10">
                <div className="max-w-[1400px] mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-white/10">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
                                    <span className="text-xs font-black text-white">H</span>
                                </div>
                                <span className="text-base font-black">HRMS Hardware Store</span>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed font-medium">Your one-stop shop for quality hardware, tools, and construction supplies for every project.</p>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Quick Links</p>
                            <div className="space-y-2">
                                {[['Log in', '/login'], ['Register', '/register'], ['Supplier Portal', '/supplier/register']].map(([label, href]) => (
                                    <Link key={href} to={href} className="block text-sm text-gray-400 hover:text-white transition-colors font-medium">{label}</Link>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Our Promises</p>
                            <div className="space-y-2">
                                {BENEFITS.map(({ title }) => (
                                    <div key={title} className="flex items-center gap-2">
                                        <CheckCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                        <span className="text-sm text-gray-400">{title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <p className="text-xs text-gray-500">© {new Date().getFullYear()} HRMS Hardware Store. All rights reserved.</p>
                        <p className="text-xs text-gray-500">Built for quality, delivered with care.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
