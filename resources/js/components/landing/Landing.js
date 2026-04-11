import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { silentApi } from "../../lib/api";
import {
    Package, ShieldCheck, Truck, Wrench, ShoppingCart, ArrowRight,
    X, Headphones, RefreshCw, Wallet, Zap, Hammer, Ruler,
    Paintbrush, Scissors, Settings, Box, Layers, Star, Send, CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSilentRefresh } from '../../hooks/useSilentRefresh';

const BENEFITS = [
    { icon: Truck,      title: 'Express Delivery',   desc: 'Fast and reliable delivery to your site or home.' },
    { icon: Wallet,     title: 'GCash Payment',       desc: 'Pay using GCash for fast and secure digital transactions.' },
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
            className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-xl hover:shadow-gray-200/60 hover:-translate-y-1"
            onClick={onLoginPrompt}
        >
            <div className="relative aspect-square overflow-hidden bg-gray-50 border-b border-gray-100">
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Wrench className="h-10 w-10 text-gray-200" />
                    </div>
                )}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                    <span className="bg-[#F97316] text-white text-[7px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded-full shadow-lg shadow-orange-500/20">
                        {product.category?.name || 'Hardware'}
                    </span>
                    {isOnSale && (
                        <span className="bg-red-500 text-white text-[7px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded-full shadow-lg shadow-red-500/20">
                            SALE -{saleAmt}%
                        </span>
                    )}
                </div>
            </div>
            <div className="p-4 space-y-3">
                <div className="min-h-[52px]">
                    <h3 className="text-base font-black text-gray-900 leading-tight group-hover:text-[#F97316] transition-colors line-clamp-1">{product.name}</h3>
                    <p className="text-[9px] text-gray-500 leading-normal line-clamp-2 font-medium mt-1">
                        {product.description || 'Premium quality hardware for any construction or repair project.'}
                    </p>
                </div>
                <div className="flex items-end gap-2 pt-1">
                    <span className="text-lg font-black text-[#F97316] leading-none">
                        ₱{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {isOnSale && (
                        <span className="text-[9px] text-gray-400 line-through font-bold leading-none mb-0.5">
                            ₱{originalPrice.toFixed(2)}
                        </span>
                    )}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onLoginPrompt(); }}
                    className="w-full h-9 bg-[#F97316] hover:bg-orange-600 active:scale-95 text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-[0.1em]">Login to Shop</span>
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
    const { refreshTrigger } = useSilentRefresh('landing_products');

    useEffect(() => {
        let mounted = true;
        const t = setTimeout(async () => {
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
        }, 400);
        return () => { mounted = false; clearTimeout(t); };
    }, [refreshTrigger]);

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
                <ShieldCheck className="h-4 w-4 text-[#F97316]" />
                <span className="text-[13px] font-bold">Please <span className="text-[#F97316] underline">sign in</span> to shop</span>
                <button className="ml-1 h-5 w-5 flex items-center justify-center text-white/50 hover:text-white" onClick={(e) => { e.stopPropagation(); setNotification(false); }}>
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* ── NAV ── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200 shadow-sm">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between h-16">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]">
                            <span className="text-xs font-black text-white">H</span>
                        </div>
                        <span className="text-lg font-black text-gray-900">HRMS</span>
                    </div>
                    <div className="hidden lg:flex items-center gap-1 overflow-x-auto">
                        {[
                            { href: '#hero',         label: 'Home' },
                            { href: '#categories',   label: 'Categories' },
                            { href: '#products',     label: 'Popular Products' },
                            { href: '#deals',        label: 'Best Sellers' },
                            { href: '#benefits',     label: 'Benefits' },
                            { href: '#testimonials', label: 'Testimonials' },
                            { href: '#newsletter',   label: 'Newsletter' },
                        ].map(({ href, label }) => (
                            <a key={href} href={href} className="shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold text-gray-600 hover:bg-orange-50 hover:text-[#F97316] transition-colors whitespace-nowrap">
                                {label}
                            </a>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" className="font-semibold text-gray-600" asChild><Link to="/login">Log in</Link></Button>
                        <Button className="bg-[#F97316] hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/20" asChild>
                            <Link to="/register">Get Started <ArrowRight className="h-4 w-4" /></Link>
                        </Button>
                    </div>
                </div>
            </nav>

            {/* ── SECTION 1: HERO ── */}
            <header id="hero" className="relative pt-16 min-h-[520px] md:min-h-[600px] flex items-center overflow-hidden">
                <div className="absolute inset-0">
                    <img src="https://img.pikbest.com/wp/202343/hardware-tools-displayed-against-textured-metal-background_9965912.jpg!f305cw" alt="" className="w-full h-full object-cover object-center md:object-right" />
                    <div className="absolute inset-0 bg-black/65" />
                </div>
                <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-28">
                    <p className="text-[#F97316] font-black uppercase tracking-[0.2em] text-xs mb-4">Your Trusted Hardware Store</p>
                    <h1 className="text-4xl sm:text-5xl md:text-[3.75rem] font-black text-white leading-[1.08] tracking-tight mb-5 max-w-2xl">
                        For all your Home and<br />Hardware Needs
                    </h1>
                    <p className="text-base text-gray-300 max-w-xl leading-relaxed mb-8">
                        Shop the widest selection of hardware, tools, and supplies for your construction, repair, and home improvement projects — all in one place.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button size="lg" className="h-12 px-8 bg-white text-gray-900 hover:bg-gray-100 font-bold text-sm shadow-xl" onClick={triggerLoginNotice}>
                            <ShoppingCart className="h-4 w-4" /> Explore Products
                        </Button>
                        <Button size="lg" className="h-12 px-8 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-sm shadow-xl shadow-orange-500/30" asChild>
                            <Link to="/supplier/register">Partner with Us <ArrowRight className="h-4 w-4" /></Link>
                        </Button>
                    </div>
                </div>
            </header>

            {/* ── SECTION 2: BENEFITS STRIP ── */}
            <div className="bg-[#F97316]">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {BENEFITS.map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="flex items-start gap-3">
                            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                                <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-white leading-tight">{title}</p>
                                <p className="text-[11px] text-orange-100 leading-tight mt-0.5">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── SECTION 3: EXPLORE BY CATEGORY ── */}
            <section id="categories" className="py-14 md:py-20 bg-white">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="text-center mb-10">
                        <p className="text-[#F97316] font-black uppercase tracking-[0.15em] text-xs mb-2">Browse</p>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">Explore by Category</h2>
                    </div>
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Category sidebar with search */}
                        <div className="md:w-52 shrink-0 flex flex-col gap-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={categorySearch}
                                    onChange={e => setCategorySearch(e.target.value)}
                                    placeholder="Search categories..."
                                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50"
                                />
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </div>
                            <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto pr-1">
                                {displayCats
                                    .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                    .map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveCategory(String(cat.id))}
                                            className={cn(
                                                "text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                                                activeCategory === String(cat.id)
                                                    ? "bg-[#F97316] text-white shadow-md shadow-orange-500/20"
                                                    : "text-gray-600 hover:bg-orange-50 hover:text-[#F97316]"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                            </div>
                            <Button variant="outline" className="mt-1 border-[#F97316] text-[#F97316] hover:bg-orange-50 font-bold text-sm" onClick={triggerLoginNotice}>
                                All Categories <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                        {/* Products in selected category */}
                        <div className="flex-1">
                            {(categories.length > 0 ? categoryLoading : loading) ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="animate-pulse">
                                            <div className="aspect-square bg-gray-200 rounded-xl mb-3" />
                                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                                            <div className="h-3 bg-gray-100 rounded w-1/2" />
                                        </div>
                                    ))}
                                </div>
                            ) : (categories.length > 0 ? categoryProducts : popularProducts.slice(0, 6)).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                                    <Package className="h-10 w-10 text-gray-200 mb-2" />
                                    <p className="text-sm text-gray-400 font-medium">No products in this category yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {(categories.length > 0 ? categoryProducts : popularProducts.slice(0, 6)).map(p => (
                                        <LandingProductCard key={p.id} product={p} onLoginPrompt={triggerLoginNotice} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION 4: POPULAR PRODUCTS ── */}
            <section id="products" className="py-14 md:py-20 bg-gray-50">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="text-center mb-10">
                        <p className="text-[#F97316] font-black uppercase tracking-[0.15em] text-xs mb-2">Top Rated</p>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">Popular Products</h2>
                    </div>
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="aspect-square bg-gray-200 rounded-2xl mb-4" />
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {popularProducts.map(p => <LandingProductCard key={p.id} product={p} onLoginPrompt={triggerLoginNotice} />)}
                        </div>
                    )}
                    <div className="text-center mt-10">
                        <Button size="lg" className="bg-[#F97316] hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/20 h-12 px-10" onClick={triggerLoginNotice}>
                            Explore all items <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* ── SECTION 5: BEST SELLERS ── */}
            <section id="deals" className="py-14 md:py-20 bg-white">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="rounded-2xl bg-[#F97316] p-8 md:p-12 text-white order-2 md:order-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-200 mb-3">Top Selling</p>
                            <h2 className="text-3xl md:text-4xl font-black leading-tight mb-4">Our Best Sellers<br />— Loved by Customers</h2>
                            <p className="text-sm text-orange-100 leading-relaxed mb-5">These are the most purchased products by our customers. Trusted quality, proven performance.</p>
                            {bestSellers.length > 0 && (() => {
                                const avg = bestSellers.reduce((s, p) => s + Number(p.average_rating || 0), 0) / bestSellers.length;
                                return (
                                    <div className="flex items-center gap-3 mb-6">
                                        <RatingStars rating={Math.round(avg)} />
                                        <span className="text-xs text-orange-200 font-semibold">Avg {avg.toFixed(1)}/5 from verified buyers</span>
                                    </div>
                                );
                            })()}
                            <Button size="lg" className="bg-white text-[#F97316] hover:bg-gray-100 font-black h-11 px-7 text-sm" onClick={triggerLoginNotice}>
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
                                        <div key={p.id} className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden aspect-square cursor-pointer group" onClick={triggerLoginNotice}>
                                            {img
                                                ? <img src={img} alt={p.name} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-65 transition-opacity" />
                                                : <div className="absolute inset-0 flex items-center justify-center"><Icon className="h-12 w-12 text-white/20" /></div>
                                            }
                                            {isOnSale && (
                                                <span className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                                                    SALE
                                                </span>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                                <p className="text-[11px] font-black text-white line-clamp-1">{p.name}</p>
                                                <p className="text-[10px] text-orange-300 font-bold">₱{Number(p.sale_price || p.sell_price || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                const { gradient, icon: Icon, title, sub } = item;
                                return (
                                    <div key={title} className={`relative bg-gradient-to-br ${gradient} rounded-2xl overflow-hidden aspect-square cursor-pointer flex items-center justify-center group`} onClick={triggerLoginNotice}>
                                        <Icon className="h-12 w-12 text-white/20 group-hover:text-white/30 transition-colors" />
                                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/40">
                                            <p className="text-sm font-black text-white">{title}</p>
                                            <p className="text-[10px] text-gray-300">{sub}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION 6: BENEFITS FOR YOUR EXPERIENCE ── */}
            <section id="benefits" className="py-14 md:py-20 bg-gray-100">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="text-center mb-10">
                        <p className="text-[#F97316] font-black uppercase tracking-[0.15em] text-xs mb-1">Why Choose Us</p>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">Benefits for your experience</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {BENEFITS.map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="flex flex-col items-center text-center gap-3 p-6 bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-xl transition-shadow">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 border-2 border-orange-100">
                                    <Icon className="h-7 w-7 text-[#F97316]" />
                                </div>
                                <p className="text-[13px] font-black text-gray-900">{title}</p>
                                <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── SECTION 7: CUSTOMER FEEDBACK ── */}
            <section id="testimonials" className="py-14 md:py-20 bg-white">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10">
                    <div className="text-center mb-10">
                        <p className="text-[#F97316] font-black uppercase tracking-[0.15em] text-xs mb-1">Customer Feedback</p>
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
                                        {text && <p className="text-sm text-gray-600 leading-relaxed flex-1">"{text}"</p>}
                                        {productName && (
                                            <p className="text-[10px] text-[#F97316] font-bold uppercase tracking-wide">re: {productName}</p>
                                        )}
                                        <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                                            <div className="h-9 w-9 rounded-full bg-[#F97316] flex items-center justify-center text-white font-black text-sm shrink-0">
                                                {name[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-black text-gray-900">{name}</p>
                                                {review.is_verified_purchase && (
                                                    <p className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
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

            {/* ── SECTION 8: NEWSLETTER ── */}
            <section id="newsletter" className="py-14 md:py-20 bg-gray-900">
                <div className="max-w-[1400px] mx-auto px-6 md:px-10 text-center">
                    <p className="text-[#F97316] font-black uppercase tracking-[0.15em] text-xs mb-3">Stay Updated</p>
                    <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Join Our Newsletter</h2>
                    <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">Get the latest hardware deals, new arrivals, and exclusive offers delivered to your inbox.</p>
                    <div className="flex gap-3 max-w-md mx-auto">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email address"
                            className="flex-1 h-11 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-gray-500 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                        />
                        <Button className="h-11 px-6 bg-[#F97316] hover:bg-orange-600 text-white font-bold shrink-0" onClick={triggerLoginNotice}>
                            <Send className="h-4 w-4" /> Subscribe
                        </Button>
                    </div>
                    <p className="text-[11px] text-gray-600 mt-3">No spam, unsubscribe anytime.</p>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer id="about" className="bg-gray-900 border-t border-white/5 text-white py-12 px-6 md:px-10">
                <div className="max-w-[1400px] mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-white/10">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]">
                                    <span className="text-xs font-black text-white">H</span>
                                </div>
                                <span className="text-base font-black">HRMS Hardware Store</span>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">Your one-stop shop for quality hardware, tools, and construction supplies for every project.</p>
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
                                        <CheckCircle className="h-3.5 w-3.5 text-[#F97316] shrink-0" />
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
