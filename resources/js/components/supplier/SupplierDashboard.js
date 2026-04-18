import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    PhilippinePeso, ClipboardList, Package, Truck,
    BarChart3, ArrowRight, Plus, ClipboardCheck, Settings,
    ChevronRight, FileText, AlertTriangle, TrendingUp, Save
} from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { STALE_KEYS, markStale } from '../../store/dataStore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import BarChart from '../shared/BarChart';
import LineChart from '../shared/LineChart';
import ConfirmModal from '../shared/ConfirmModal';
import { ChevronDown } from 'lucide-react';

export default function SupplierDashboard() {
    const { user } = useAuth();
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.SUPPLIER_DASHBOARD);
    const [stats, setStats] = useState({ pending: 0, approved: 0, delivered: 0, total: 0, totalRevenue: 0, productCount: 0 });
    const [recentPos, setRecentPos] = useState([]);
    const [products, setProducts] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [revenueTrend, setRevenueTrend] = useState([]);
    const [loading, setLoading] = useState(recentPos.length === 0);
    const [trendLoading, setTrendLoading] = useState(false);

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState("all");

    const years = Array.from({ length: currentYear - 2000 + 1 }, (_, i) => 2000 + i).reverse();
    const months = [
        { value: "all", label: "All Months" },
        { value: "1", label: "January" },
        { value: "2", label: "February" },
        { value: "3", label: "March" },
        { value: "4", label: "April" },
        { value: "5", label: "May" },
        { value: "6", label: "June" },
        { value: "7", label: "July" },
        { value: "8", label: "August" },
        { value: "9", label: "September" },
        { value: "10", label: "October" },
        { value: "11", label: "November" },
        { value: "12", label: "December" },
    ];

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

    const fetchDashboardData = async (silent = false) => {
        if (!silent && recentPos.length === 0) setLoading(true);
        try {
            const [posRes, prodsRes] = await Promise.all([
                api.get('/supplier/purchase-orders?per_page=100'),
                api.get('/supplier/products?per_page=100').catch(() => ({ data: { data: { total: 0, data: [] } } })),
            ]);
            const pos = posRes.data.data.data || [];
            setRecentPos(pos);

            const prods = prodsRes.data.data.data || [];
            setProducts(prods);

            const lowStock = prods.filter(p => Number(p.total_stock) <= Number(p.min_order_qty || 10));
            setLowStockProducts(lowStock);

            const topProds = [...prods].sort((a,b) => (Number(b.price)*Number(b.total_stock)) - (Number(a.price)*Number(a.total_stock))).slice(0, 5);
            setTopProducts(topProds);

            const allTotal = posRes.data.data.total || 0;
            const revenue = pos.reduce((s, p) => s + Number(p.total_cost || 0), 0);
            
            // Calculate Monthly Revenue Trend (Last 6 Months)
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const trendMap = {};
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
                trendMap[key] = { label: months[d.getMonth()], value: 0 };
            }

            // Fill with real data if available in the fetched pool
            pos.forEach(po => {
                const poDate = new Date(po.created_at);
                const key = `${months[poDate.getMonth()]} ${poDate.getFullYear()}`;
                if (trendMap[key]) {
                    trendMap[key].value += Number(po.total_cost || 0);
                }
            });

            setRevenueTrend(Object.values(trendMap));

            setStats({
                pending: pos.filter(p => p.status === 'pending').length,
                approved: pos.filter(p => p.status === 'pending_supplier').length,
                delivered: pos.filter(p => p.status === 'supplier_delivered').length,
                total: allTotal,
                totalRevenue: revenue,
                productCount: prodsRes.data.data.total || 0,
            });
        } catch (err) {
            // Silently fail on background error
        } finally {
            if (!silent) setLoading(false);
        }
    };
    const fetchRevenueTrend = async () => {
        setTrendLoading(true);
        try {
            const period = selectedMonth === "all" ? "year" : "month";
            const response = await api.get('/supplier/reports/revenue', {
                params: {
                    period,
                    year: selectedYear,
                    month: selectedMonth === "all" ? undefined : selectedMonth
                }
            });
            setRevenueTrend(response.data.data);
        } catch (err) {
            console.error("Failed to fetch revenue trend", err);
        } finally {
            setTrendLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData(recentPos.length > 0);
    }, [refreshTrigger]);

    useEffect(() => {
        fetchRevenueTrend();
    }, [selectedYear, selectedMonth, refreshTrigger]);

    const getStatusBadge = (status) => {
        const variants = {
            pending: 'secondary',
            pending_supplier: 'default',
            accepted: 'default',
            supplier_delivered: 'outline',
            received: 'default',
        };
        const labels = { pending: 'Draft', pending_supplier: 'Awaiting Response', accepted: 'Accepted', supplier_delivered: 'Delivered', received: 'Received' };
        return <Badge variant={variants[status] || 'secondary'} className={status === 'received' ? 'bg-green-100 text-green-700 border-green-200' : status === 'supplier_delivered' ? 'bg-orange-100 text-orange-700 border-orange-200' : status === 'pending_supplier' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}>{labels[status] || status}</Badge>;
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
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight">{user?.name || 'Supplier'}</h2>
                    <p className="text-sm text-white/80 max-w-xl leading-relaxed mb-6">Manage your products, track purchase orders, and grow your business with HRMS.</p>
                    <div className="flex flex-wrap gap-3">
                        <Button size="sm" className="bg-white text-slate-800 hover:bg-white/90 font-semibold shadow-lg" asChild>
                            <Link to="/supplier/products">Manage Products</Link>
                        </Button>
                        <Button size="sm" variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm font-semibold" asChild>
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Top Products */}
                <Card className="p-5 flex flex-col h-[380px] shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Top Products
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Highest value by inventory stock (Top 5)
                        </p>
                    </div>
                    <div className="flex-grow">
                        {topProducts.length > 0 ? (
                            <BarChart
                                data={topProducts.map(p => ({ label: p.name, value: Number(p.price) * Number(p.total_stock) }))}
                                formatValue={(v) => `₱${Number(v).toLocaleString()}`}
                                color="#8b5cf6"
                                hideHeader
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-50">
                                <Package className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-xs font-medium">No products available</p>
                            </div>
                        )}
                    </div>
                </Card>
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
                            {recentPos.slice(0, 5).map((po) => (
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

                {/* Revenue Trend - NOW BESIDE STOCK ALERTS */}
                <Card className="p-5 flex flex-col h-[380px] shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-blue-500" />
                                Revenue Performance
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {selectedMonth === "all" ? `Monthly revenue for ${selectedYear}` : `Daily revenue for ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select
                                value={selectedMonth}
                                onValueChange={(val) => setSelectedMonth(val)}
                            >
                                <SelectTrigger className="h-8 w-[120px] text-[11px] font-bold bg-secondary/50 border-0 focus:ring-1 focus:ring-primary shadow-sm hover:bg-secondary transition-colors">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={10} align="start" className="border-border/50 shadow-xl max-h-[250px] overflow-y-auto z-[101]">
                                    {months.map(m => (
                                        <SelectItem key={m.value} value={m.value} className="text-[11px] font-medium py-1.5 focus:bg-primary/10 focus:text-primary cursor-pointer">
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={selectedYear.toString()}
                                onValueChange={(val) => setSelectedYear(parseInt(val))}
                            >
                                <SelectTrigger className="h-8 w-[80px] text-[11px] font-bold bg-secondary/50 border-0 focus:ring-1 focus:ring-primary shadow-sm hover:bg-secondary transition-colors">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={10} align="end" className="border-border/50 shadow-xl max-h-[250px] overflow-y-auto z-[101]">
                                    {years.map(y => (
                                        <SelectItem key={y} value={y.toString()} className="text-[11px] font-medium py-1.5 focus:bg-primary/10 focus:text-primary cursor-pointer">
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex-grow min-h-0 relative">
                        {trendLoading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                        <LineChart 
                            data={revenueTrend}
                            color="#2563eb"
                            formatValue={(v) => `₱${Number(v).toLocaleString()}`}
                            title=""
                            hideHeader={true}
                        />
                    </div>
                </Card>

                {/* Stock Alert */}
                <Card className="p-5 flex flex-col h-[380px] shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-amber-500" />
                                Stock Alerts
                            </h3>
                            <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-100 bg-amber-50/50">
                                Live Feed
                            </Badge>
                        </div>
                        <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
                            {lowStockProducts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full opacity-50 border border-dashed rounded-xl p-4">
                                    <Package className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-xs font-medium">No low stock items</p>
                                </div>
                            ) : (
                                lowStockProducts.map((p) => (
                                    <div key={p.id} className="flex gap-3 items-start group border-b border-slate-50 pb-3 last:border-0">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 text-amber-600">
                                            <AlertTriangle className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <h4 className="text-[11px] font-bold text-slate-700 truncate">{p.name}</h4>
                                                <span className="text-[9px] font-medium text-amber-600 shrink-0">Stock: {p.total_stock}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mb-2">Barcode: {p.barcode}</p>
                                            <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-bold uppercase bg-amber-50 text-amber-700 border-amber-100">
                                                Low Stock
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
            </div>
            
            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
