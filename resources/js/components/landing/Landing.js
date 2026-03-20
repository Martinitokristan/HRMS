import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Package, ShieldCheck, Truck, BarChart3, Wrench, ShoppingCart, ArrowRight, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Landing() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(false);

    useEffect(() => {
        axios.get('/api/products', { params: { per_page: 8 } })
            .then(r => {
                const d = r.data.data;
                setProducts(d.data ? d.data : d);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const triggerLoginNotice = () => {
        setNotification(true);
        setTimeout(() => setNotification(false), 1500);
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Toast notification */}
            <div className={cn(
                "fixed left-1/2 -translate-x-1/2 z-[9999] transition-all duration-700 ease-out",
                "flex items-center gap-3 bg-card text-destructive px-6 py-3 rounded-lg shadow-modal border border-destructive/20 min-w-[340px] justify-center cursor-pointer",
                notification ? "top-6 opacity-100" : "-top-24 opacity-0"
            )} onClick={() => navigate('/login')}>
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[13px] font-extrabold uppercase tracking-wider">
                    Unauthorized: <span className="underline ml-1">Sign In Required</span>
                </span>
                <Button variant="ghost" size="icon" className="ml-2 h-6 w-6 text-destructive/60 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setNotification(false); }}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                            <span className="text-xs font-black text-primary-foreground">H</span>
                        </div>
                        <span className="text-lg font-bold tracking-tight text-foreground">
                            HRMS <span className="text-primary">Pro</span>
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Features</a>
                        <a href="#products" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Store</a>
                        <a href="#about" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Partners</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" asChild>
                            <Link to="/login">Log in</Link>
                        </Button>
                        <Button asChild>
                            <Link to="/register">
                                Get Started <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <header className="relative pt-16 overflow-hidden" style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)',
            }}>
                <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 relative z-10">
                    <Badge variant="outline" className="border-primary/25 bg-primary/15 text-primary mb-8 px-4 py-1.5 text-[13px] font-extrabold uppercase tracking-wider">
                        <Star className="h-3.5 w-3.5 mr-2 fill-current" />
                        Premium Hardware Solutions
                    </Badge>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-black text-white leading-[1.08] tracking-tight mb-6">
                        Industrial Grade{' '}<br className="hidden md:block" />
                        <span className="text-primary">Hardware</span> Retail<br className="hidden md:block" /> Management
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
                        The ultimate full-stack solution built specifically for hardware retail businesses.
                        Manage inventory, sales, and deliveries with precision and speed.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <Button variant="outline" size="lg" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white h-12 px-7 text-[15px]" onClick={triggerLoginNotice}>
                            <ShoppingCart className="h-4 w-4" /> Explore Shop
                        </Button>
                        <Button size="lg" className="h-12 px-7 text-[15px] shadow-lg shadow-primary/25" asChild>
                            <Link to="/supplier/register">
                                Partner with us <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 pt-10 border-t border-white/10">
                        {[
                            { val: '2M+', lbl: 'Products Managed' },
                            { val: '99%', lbl: 'Uptime SLA' },
                            { val: '24/7', lbl: 'Support' },
                            { val: '10k+', lbl: 'Active Users' },
                        ].map((s, i) => (
                            <div key={i} className="text-center md:text-left">
                                <div className="text-3xl md:text-4xl font-black text-white">{s.val}</div>
                                <div className="text-sm text-slate-400 font-medium mt-1">{s.lbl}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-1/2 h-full opacity-5 pointer-events-none" style={{
                    backgroundImage: 'radial-gradient(circle at 70% 30%, #FF6B35, transparent 50%)',
                }} />
            </header>

            {/* Product Catalog */}
            <section id="products" className="py-20 md:py-28 px-6 bg-background">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <Badge variant="secondary" className="text-primary font-extrabold uppercase tracking-[0.15em] mb-3">Our Catalog</Badge>
                        <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">Professional Hardware Catalog</h2>
                        <p className="text-muted-foreground text-lg max-w-lg mx-auto">Preview our professional-grade tools and supplies.</p>
                    </div>

                    {loading ? (
                        <div className="text-center py-16">
                            <div className="spinner mx-auto" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {products.map(p => (
                                <Card key={p.id} className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover overflow-hidden">
                                    <CardContent className="p-5">
                                        <div className="h-48 flex items-center justify-center rounded-lg bg-secondary mb-4 overflow-hidden">
                                            {p.image_path
                                                ? <img src={`/storage/${p.image_path}`} alt={p.name} className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                                                : <Wrench className="h-12 w-12 text-muted-foreground/30" />
                                            }
                                        </div>
                                        <Badge variant="secondary" className="text-primary text-[10px] font-extrabold uppercase tracking-[0.12em] mb-1">
                                            {p.category?.name || 'Supply'}
                                        </Badge>
                                        <h3 className="text-[15px] font-bold text-foreground mt-1 leading-snug line-clamp-2 h-10">{p.name}</h3>
                                        <div className="text-xl font-black text-foreground mt-3">
                                            ₱{Number(p.sell_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        <Button variant="secondary" className="w-full mt-4 hover:bg-primary hover:text-primary-foreground" onClick={triggerLoginNotice}>
                                            Login to Shop
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    <div className="text-center mt-12">
                        <Button size="lg" onClick={triggerLoginNotice}>
                            View Full Catalog <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-20 md:py-28 px-6 bg-secondary">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <Badge variant="secondary" className="text-primary font-extrabold uppercase tracking-[0.15em] mb-3 bg-primary/10">Capabilities</Badge>
                        <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">Everything you need to scale</h2>
                        <p className="text-muted-foreground text-lg max-w-lg mx-auto">Powerful features to automate your day-to-day hardware store operations.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: Package, title: 'Smart Inventory', desc: 'Track stock levels in real-time, get low-stock alerts, and auto-generate purchase orders.' },
                            { icon: ShoppingCart, title: 'Omnichannel Sales', desc: 'Process walk-in POS transactions and online customer portal orders from a unified dashboard.' },
                            { icon: Truck, title: 'Delivery Logistics', desc: 'Real-time GPS tracking, rider management, and Kanban-based fulfillment pipeline.' },
                            { icon: BarChart3, title: 'Reports & Analytics', desc: 'Revenue trends, top products, conversion rates, and export-ready PDF reports.' },
                        ].map(({ icon: Icon, title, desc }, i) => (
                            <Card key={i} className="transition-all hover:-translate-y-1 hover:shadow-card-hover">
                                <CardContent className="p-7">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-light text-primary mb-5">
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-[15px] font-bold text-foreground mb-2">{title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border bg-background py-10 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                            <span className="text-[10px] font-black text-primary-foreground">H</span>
                        </div>
                        <span className="text-[15px] font-bold text-foreground">
                            HRMS <span className="text-primary">Pro</span>
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Hardware Retail Management System. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
