import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ShoppingCart, Sparkles, Tag, ArrowRight, Star } from 'lucide-react';
import { getProductSaleInfo } from '../../utils/priceCalculations';

// Radial-gradient themes per slide type
var SLIDE_THEMES = {
    sale: {
        radial: 'radial-gradient(ellipse at 60% 50%, #FF8C42 0%, #C94A00 55%, #7A2500 100%)',
        badge: 'HOT DEAL',
        badgeBg: 'rgba(255,255,255,0.15)',
        label: 'Limited Offer',
        Icon: Tag,
        accentColor: '#FF8C42',
    },
    top: {
        radial: 'radial-gradient(ellipse at 60% 50%, #F6C352 0%, #B45309 55%, #6B2D00 100%)',
        badge: 'TOP RATED',
        badgeBg: 'rgba(255,255,255,0.15)',
        label: 'Customer Favorite',
        Icon: Star,
        accentColor: '#F6C352',
    },
    new: {
        radial: 'radial-gradient(ellipse at 60% 50%, #818CF8 0%, #4F46E5 55%, #1E1B4B 100%)',
        badge: 'NEW ARRIVAL',
        badgeBg: 'rgba(255,255,255,0.15)',
        label: 'Just In Store',
        Icon: Sparkles,
        accentColor: '#A5B4FC',
    },
};

var SLIDE_DURATION = 5500;
var TRANSITION_MS = 480;

export default function ProductCarousel({ products = [], setSelectedProduct, onAddToCart, onBuyNow }) {
    const [index, setIndex] = useState(0);          // currently displayed slide
    const [prevIndex, setPrevIndex] = useState(null); // exiting slide during transition
    const [direction, setDirection] = useState(1);    // 1 = forward, -1 = backward
    const [transitioning, setTransitioning] = useState(false);
    const [paused, setPaused] = useState(false);
    const [adding, setAdding] = useState(false);
    const [animKey, setAnimKey] = useState(0);
    const transTimerRef = useRef(null);

    // Build slides: sale → top-rated → new, deduplicated, max 8
    const slides = useMemo(function() {
        var seen = new Set();
        var result = [];
        function push(p, type) {
            if (seen.has(p.id)) return;
            seen.add(p.id);
            result.push({ product: p, type: type });
        }
        products.forEach(function(p) {
            var s = getProductSaleInfo(p);
            if (s && s.isOnSale) push(p, 'sale');
        });
        products.slice().filter(function(p) { return p.average_rating > 0; })
            .sort(function(a, b) { return (b.average_rating || 0) - (a.average_rating || 0); })
            .forEach(function(p) { push(p, 'top'); });
        products.slice().sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); })
            .forEach(function(p) { push(p, 'new'); });
        return result.slice(0, 8);
    }, [products]);

    const total = slides.length;

    const goTo = useCallback(function(i, dir) {
        if (transitioning || total < 2) return;
        var next = ((i % total) + total) % total;
        if (next === index) return;
        var d = dir !== undefined ? dir : (next > index ? 1 : -1);
        // Handle wrap-around direction
        if (index === total - 1 && next === 0) d = 1;
        if (index === 0 && next === total - 1) d = -1;
        setPrevIndex(index);
        setDirection(d);
        setTransitioning(true);
        setIndex(next);
        setAnimKey(function(k) { return k + 1; });
        clearTimeout(transTimerRef.current);
        transTimerRef.current = setTimeout(function() {
            setTransitioning(false);
            setPrevIndex(null);
        }, TRANSITION_MS);
    }, [index, total, transitioning]);

    useEffect(function() {
        return function() { clearTimeout(transTimerRef.current); };
    }, []);

    // Auto-play: starts only when not transitioning
    useEffect(function() {
        if (paused || total < 2 || transitioning) return;
        var t = setTimeout(function() { goTo(index + 1, 1); }, SLIDE_DURATION);
        return function() { clearTimeout(t); };
    }, [index, paused, total, transitioning]);

    const handleAddToCart = async function(e, product) {
        e.stopPropagation();
        if (adding) return;
        setAdding(true);
        try {
            var allVariants = product.product_variants || [];
            var av = allVariants.find(function(v) { return (v.available_stock || v.stock || 0) > 0; });
            await onAddToCart(product, av ? { variant_id: av.id } : {});
        } finally {
            setAdding(false);
        }
    };

    if (total === 0) return null;

    // Helper: render one slide's content
    var renderSlide = function(slideIndex, animClass) {
        var sl = slides[slideIndex];
        if (!sl) return null;
        var p = sl.product;
        var th = SLIDE_THEMES[sl.type];
        var si = getProductSaleInfo(p);
        var src = p.image_path ? '/storage/' + p.image_path : null;
        var price = Number(si && si.isOnSale ? si.salePrice : p.price || 0);
        var variants = p.product_variants || [];
        var vStock = variants.reduce(function(s, v) { return s + Number(v.available_stock || v.stock || 0); }, 0);
        var bStock = Number(p.available_stock || (p.inventory && p.inventory.current_stock) || 0);
        var stock = (variants.length > 0 ? vStock : bStock) > 0;
        var TIcon = th.Icon;
        var hasBg = !!p.banner_bg_path;
        var bgSrc = hasBg
            ? (p.banner_bg_path.indexOf('http') === 0 ? p.banner_bg_path : '/storage/' + p.banner_bg_path + '?v=' + (p.updated_at || '1'))
            : null;
        return (
            <div
                className={'absolute inset-0 flex items-center pr-20 ' + animClass}
                style={{ zIndex: (animClass && animClass.indexOf('slide-enter') === 0) ? 2 : 1 }}
            >
                {hasBg && (
                    <>
                        <img src={bgSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.05) 100%)' }} />
                    </>
                )}
                {/* LEFT: Text */}
                <div className="relative z-10 flex-1 pl-14 sm:pl-24 pr-4 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-4">
                        <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] border border-white/25 backdrop-blur-sm"
                            style={{ background: th.badgeBg, color: 'white' }}
                        >
                            <TIcon className="h-3 w-3" />
                            {th.badge}
                        </span>
                        <span className="text-white/60 text-[11px] font-semibold tracking-wide">{th.label}</span>
                    </div>
                    <h2
                        className="font-black text-white leading-none mb-3"
                        style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', letterSpacing: '-0.03em', textShadow: '0 2px 8px rgba(0,0,0,0.6), 0 4px 24px rgba(0,0,0,0.4)', maxWidth: '340px' }}
                    >
                        {p.name}
                    </h2>
                    {p.average_rating > 0 && (
                        <div className="flex items-center gap-1.5 mb-4">
                            {[1,2,3,4,5].map(function(s) {
                                return (
                                    <Star key={s} className="h-3.5 w-3.5"
                                        fill={s <= Math.round(p.average_rating) ? th.accentColor : 'transparent'}
                                        stroke={th.accentColor} strokeWidth={1.5}
                                    />
                                );
                            })}
                            <span className="text-white/70 text-xs font-semibold ml-0.5">
                                {Number(p.average_rating).toFixed(1)}
                                {p.total_reviews > 0 ? '  ·  ' + p.total_reviews + ' reviews' : ''}
                            </span>
                        </div>
                    )}
                    {price > 0 && (
                        <p className="text-white/55 text-[11px] font-semibold tracking-wide mb-4">
                            Starting at{' '}
                            <span className="text-white/80 font-black">
                                ₱{price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {si && si.isOnSale && si.discountPercent > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                                    style={{ background: th.accentColor, color: '#fff' }}>
                                    -{si.discountPercent}% OFF
                                </span>
                            )}
                        </p>
                    )}
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={function() { onBuyNow ? onBuyNow(p) : setSelectedProduct(p); }}
                            className="inline-flex items-center gap-2 h-10 px-5 bg-white text-gray-900 text-sm font-black rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-xl"
                            style={{ letterSpacing: '-0.01em' }}
                        >
                            Buy Now <ArrowRight className="h-4 w-4" />
                        </button>
                        {stock && (
                            <button
                                onClick={function(e) { handleAddToCart(e, p); }}
                                disabled={adding}
                                className="inline-flex items-center gap-1.5 h-10 px-4 text-white text-sm font-bold rounded-xl active:scale-95 transition-all border border-white/30 disabled:opacity-50"
                                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
                            >
                                <ShoppingCart className="h-4 w-4" />
                                <span className="hidden sm:inline">Add to Cart</span>
                            </button>
                        )}
                    </div>
                </div>
                {/* RIGHT: Product image */}
                {(function() {
                    // Ensure product image sits above background layers
                    var hasBanner = !!p.image_banner_path;
                    var bannerSrc = hasBanner
                        ? '/storage/' + p.image_banner_path
                        : src;
                    if (hasBanner) {
                        return (
                            <div
                                className="relative z-10 hidden sm:flex items-center justify-center flex-shrink-0"
                                style={{ width: '420px', height: '200px', marginRight: '20px', marginLeft: 'auto' }}
                            >
                                <img src={bannerSrc} alt={p.name}
                                    className="max-w-full max-h-full object-contain mix-blend-normal drop-shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                                />
                            </div>
                        );
                    }
                    return (
                        <div
                            className="relative z-10 hidden sm:flex items-center justify-center flex-shrink-0"
                            style={{
                                width: '420px', height: '200px', marginRight: '20px', marginLeft: 'auto',
                                borderRadius: '16px', overflow: 'hidden', backgroundColor: '#ffffff',
                                border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                            }}
                        >
                            {bannerSrc ? (
                                <img src={bannerSrc} alt={p.name}
                                    className="w-full h-full object-contain mix-blend-multiply p-3"
                                />
                            ) : (
                                <ShoppingCart className="h-16 w-16" style={{ color: 'rgba(200,200,200,0.6)' }} />
                            )}
                        </div>
                    );
                })()}
            </div>
        );
    };

    var currentTheme = SLIDE_THEMES[slides[index].type];

    return (
        <div className="mb-8">
            <div
                className="relative w-full rounded-2xl overflow-hidden select-none"
                style={{ height: '260px', background: currentTheme.radial, transition: 'background 0.45s cubic-bezier(0.4,0,0.2,1)' }}
                onMouseEnter={function() { setPaused(true); }}
                onMouseLeave={function() { setPaused(false); }}
            >
                {/* Noise texture overlay */}
                <div
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
                        opacity: 0.04,
                        mixBlendMode: 'overlay',
                    }}
                />
                {/* Decorative glow blobs */}
                <div className="absolute top-0 right-1/3 w-72 h-72 rounded-full pointer-events-none"
                     style={{ background: 'rgba(255,255,255,0.07)', filter: 'blur(48px)', transform: 'translate(40%, -40%)' }} />
                <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full pointer-events-none"
                     style={{ background: 'rgba(0,0,0,0.12)', filter: 'blur(40px)', transform: 'translate(-30%, 30%)' }} />

                {/* Slide stage — overflow:hidden clips scaleX wipe */}
                <div className="absolute inset-0 z-10" style={{ overflow: 'hidden' }}>
                    {/* Exiting slide */}
                    {transitioning && prevIndex !== null && renderSlide(prevIndex, 'slide-exit-' + (direction >= 0 ? 'fwd' : 'bwd'))}
                    {/* Entering (current) slide */}
                    {renderSlide(index, transitioning ? ('slide-enter-' + (direction >= 0 ? 'fwd' : 'bwd')) : 'slide-visible')}
                </div>

                {/* Prev / Next */}
                <button
                    onClick={function(e) { e.stopPropagation(); goTo(index - 1, -1); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full flex items-center justify-center text-white transition-all"
                    style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                    onClick={function(e) { e.stopPropagation(); goTo(index + 1, 1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full flex items-center justify-center text-white transition-all"
                    style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>

                {/* Pill progress indicators (Apple / Sony style) */}
                <div className="absolute bottom-5 left-10 sm:left-14 z-20 flex items-center gap-2">
                    {slides.map(function(_, i) {
                        var isActive = i === index;
                        return (
                            <button
                                key={i}
                                onClick={function(e) { e.stopPropagation(); goTo(i, i > index ? 1 : -1); }}
                                className="relative overflow-hidden rounded-full"
                                style={{
                                    width: isActive ? '40px' : '6px',
                                    height: '4px',
                                    background: 'rgba(255,255,255,0.3)',
                                    transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
                                }}
                            >
                                {isActive && !paused && (
                                    <span
                                        key={animKey}
                                        className="absolute inset-y-0 left-0 rounded-full bg-white"
                                        style={{ animation: 'pill-fill ' + SLIDE_DURATION + 'ms linear forwards' }}
                                    />
                                )}
                                {isActive && paused && (
                                    <span className="absolute inset-0 rounded-full bg-white/80" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Slide counter */}
                <div
                    className="absolute top-4 right-4 z-20 text-white text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(6px)' }}
                >
                    {index + 1} / {total}
                </div>
            </div>

            <style>{`
                @keyframes pill-fill {
                    from { width: 0%; }
                    to   { width: 100%; }
                }
                /* === ScaleX curtain wipe — GPU optimized === */
                @keyframes wipe-exit {
                    from { transform: scaleX(1); }
                    to   { transform: scaleX(0); }
                }
                @keyframes wipe-enter {
                    from { transform: scaleX(0); }
                    to   { transform: scaleX(1); }
                }
                .slide-visible {
                    transform: scaleX(1);
                    will-change: auto;
                }
                .slide-exit-fwd, .slide-exit-bwd {
                    animation: wipe-exit ${TRANSITION_MS}ms cubic-bezier(0.65,0,0.35,1) forwards;
                    will-change: transform;
                    backface-visibility: hidden;
                    pointer-events: none;
                }
                .slide-enter-fwd, .slide-enter-bwd {
                    animation: wipe-enter ${TRANSITION_MS}ms cubic-bezier(0.65,0,0.35,1) forwards;
                    will-change: transform;
                    backface-visibility: hidden;
                }
                .slide-exit-fwd  { transform-origin: right center; }
                .slide-exit-bwd  { transform-origin: left center; }
                .slide-enter-fwd { transform-origin: right center; }
                .slide-enter-bwd { transform-origin: left center; }
            `}</style>
        </div>
    );
}
