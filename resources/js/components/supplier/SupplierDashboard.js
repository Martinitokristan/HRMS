import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    PhilippinePeso, ClipboardList, Package, Truck,
    BarChart3, ArrowRight, Plus, ClipboardCheck, Settings,
    ChevronRight, FileText
} from 'lucide-react';

export default function SupplierDashboard() {
    const { supplier } = useSupplierAuth();
    const [stats, setStats] = useState({ pending: 0, approved: 0, delivered: 0, total: 0, totalRevenue: 0, productCount: 0 });
    const [recentPos, setRecentPos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDashboardData(); }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [posRes, prodsRes] = await Promise.all([
                axios.get('/supplier/purchase-orders?per_page=5'),
                axios.get('/supplier/products?per_page=1').catch(() => ({ data: { data: { total: 0 } } })),
            ]);
            const pos = posRes.data.data.data || [];
            setRecentPos(pos);

            const allTotal = posRes.data.data.total || 0;
            const revenue = pos.reduce((s, p) => s + Number(p.total_cost || 0), 0);
            setStats({
                pending: pos.filter(p => p.status === 'draft').length,
                approved: pos.filter(p => p.status === 'approved').length,
                delivered: pos.filter(p => p.status === 'supplier_delivered').length,
                total: allTotal,
                totalRevenue: revenue,
                productCount: prodsRes.data.data.total || 0,
            });
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            draft: 'secondary',
            approved: 'default',
            supplier_delivered: 'outline',
            received: 'default',
        };
        const labels = { draft: 'Draft', approved: 'Approved', supplier_delivered: 'Delivered', received: 'Received' };
        return <Badge variant={variants[status] || 'secondary'} className={status === 'received' ? 'bg-green-100 text-green-700 border-green-200' : status === 'supplier_delivered' ? 'bg-orange-100 text-orange-700 border-orange-200' : status === 'approved' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}>{labels[status] || status}</Badge>;
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

    const statCards = [
        { label: 'Total Revenue', value: `₱${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, Icon: PhilippinePeso, color: '#10b981', bg: '#ecfdf5' },
        { label: 'Total Orders', value: stats.total, Icon: ClipboardList, color: '#3b82f6', bg: '#eff6ff' },
        { label: 'My Products', value: stats.productCount, Icon: Package, color: '#8b5cf6', bg: '#f5f3ff' },
        { label: 'Pending Delivery', value: stats.approved, Icon: Truck, color: '#f59e0b', bg: '#fffbeb' },
    ];

    return (
        <div className="space-y-6 max-w-full">
            {/* Welcome Banner */}
            <Card className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white p-6 sm:p-8 relative overflow-hidden border-0 shadow-xl">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
                <div className="relative z-10">
                    <div className="text-sm text-white/60 mb-2 font-medium tracking-wide">Welcome back,</div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight">{supplier?.name || 'Supplier'}</h2>
                    <p className="text-sm text-white/80 max-w-xl leading-relaxed mb-6">Manage your products, track purchase orders, and grow your business with HRMS Pro.</p>
                    <div className="flex flex-wrap gap-3">
                        <Button size="sm" className="bg-white text-slate-800 hover:bg-white/90 font-semibold shadow-lg" asChild>
                            <Link to="/supplier/products">Manage Products</Link>
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm font-semibold" asChild>
                            <Link to="/supplier/orders">View Orders</Link>
                        </Button>
                    </div>
                </div>
                <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 opacity-10">
                    <BarChart3 className="h-32 w-32" />
                </div>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((s, i) => (
                    <Card key={i} className="p-4 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: s.bg }}>
                                <s.Icon className="h-5 w-5" style={{ color: s.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xl font-extrabold tracking-tight truncate" style={{ color: s.color }}>{s.value}</div>
                                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">{s.label}</div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] lg:grid-cols-[1fr_320px] gap-6">
                {/* Recent Orders */}
                <Card className="overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
                        <h3 className="font-bold text-foreground text-base">Recent Purchase Orders</h3>
                        <Link to="/supplier/orders" className="text-xs font-bold text-primary no-underline hover:underline flex items-center gap-1">
                            View All <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    {recentPos.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p className="font-medium">No purchase orders yet</p>
                            <p className="text-xs mt-1">Orders will appear here once created</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {recentPos.map((po) => (
                                <div key={po.id} className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 shadow-sm">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-primary mb-0.5">{po.po_number}</div>
                                        <div className="text-xs text-muted-foreground font-medium">{new Date(po.created_at).toLocaleDateString()} • {po.items?.length || 0} item{po.items?.length !== 1 ? 's' : ''}</div>
                                    </div>
                                    <div className="font-extrabold text-base whitespace-nowrap text-foreground">₱{Number(po.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                    {getStatusBadge(po.status)}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <Card className="p-6 shadow-sm">
                        <h3 className="font-bold text-foreground mb-4 text-base">Quick Actions</h3>
                        <div className="space-y-3">
                            {[
                                { to: '/supplier/products', Icon: Plus, title: 'Add New Product', desc: 'List products for admin to purchase' },
                                { to: '/supplier/orders', Icon: ClipboardCheck, title: 'Check Orders', desc: 'Review and manage POs' },
                                { to: '/supplier/settings', Icon: Settings, title: 'Account Settings', desc: 'Update profile & preferences' },
                            ].map((a, i) => (
                                <Link key={i} to={a.to} className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-secondary/60 to-secondary/40 no-underline text-inherit hover:from-secondary hover:to-secondary/60 transition-all hover:shadow-md group">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm group-hover:scale-110 transition-transform">
                                        <a.Icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm text-foreground mb-0.5">{a.title}</div>
                                        <div className="text-xs text-muted-foreground leading-relaxed">{a.desc}</div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </Link>
                            ))}
                        </div>
                    </Card>

                    {/* How It Works */}
                    <Card className="p-6 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
                        <h3 className="font-bold text-foreground mb-4 text-base">How It Works</h3>
                        <div className="space-y-4">
                            {[
                                { step: '1', title: 'Approved POs', desc: 'Admin creates POs for your products', color: 'bg-blue-500' },
                                { step: '2', title: 'Deliver Goods', desc: 'Mark PO as delivered when shipped', color: 'bg-orange-500' },
                                { step: '3', title: 'Confirmed', desc: 'Admin receives and updates inventory', color: 'bg-green-500' },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-4 items-start">
                                    <div className={`w-9 h-9 rounded-full ${item.color} text-white flex items-center justify-center text-sm font-extrabold shrink-0 shadow-md`}>{item.step}</div>
                                    <div className="flex-1 pt-1">
                                        <div className="font-bold text-sm text-foreground mb-1">{item.title}</div>
                                        <div className="text-xs text-muted-foreground leading-relaxed">{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
