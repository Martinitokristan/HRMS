import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../lib/api';
import { Link } from 'react-router-dom';
import StatCard from '../shared/StatCard';
import LineChart from '../shared/LineChart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PhilippinePeso, ShoppingBag, AlertTriangle, Bike, TrendingUp, TrendingDown, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { STALE_KEYS } from '../../store/dataStore';

const BAR_COLORS = {
    current: '#FF6B35',
    previous: '#94a3b8',
};

function CategoryBarChart({ data, periodLabel, prevLabel, metric, formatValue, totalCategories }) {
    const scrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const maxVal = Math.max(...data.map(d => Math.max(d[`current_${metric}`], d[`previous_${metric}`])), 1);

    const checkScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };

    useEffect(() => { checkScroll(); }, [data]);

    const scroll = (dir) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * 200, behavior: 'smooth' });
        setTimeout(checkScroll, 350);
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground">
                <div className="text-center">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No category data available</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            {canScrollLeft && (
                <button onClick={() => scroll(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white shadow-md border flex items-center justify-center hover:bg-secondary transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                </button>
            )}
            {canScrollRight && (
                <button onClick={() => scroll(1)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white shadow-md border flex items-center justify-center hover:bg-secondary transition-colors">
                    <ChevronRight className="h-4 w-4" />
                </button>
            )}

            <div ref={scrollRef} onScroll={checkScroll} className="overflow-x-auto scrollbar-thin pb-2" style={{ scrollbarWidth: 'thin' }}>
                <div className="flex items-end gap-1 min-w-0" style={{ minWidth: data.length > 6 ? `${data.length * 90}px` : '100%' }}>
                    {data.map((cat, idx) => {
                        const curH = (cat[`current_${metric}`] / maxVal) * 160;
                        const prevH = (cat[`previous_${metric}`] / maxVal) * 160;
                        return (
                            <div key={cat.id || idx} className="flex flex-col items-center flex-1" style={{ minWidth: 70, maxWidth: 120 }}>
                                <div className="flex items-end gap-1 h-[170px]">
                                    <div className="relative group">
                                        <div
                                            className="w-7 rounded-t-md transition-all duration-300"
                                            style={{ height: Math.max(prevH, 3), backgroundColor: BAR_COLORS.previous }}
                                        />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-foreground text-background text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                                            {prevLabel}: {formatValue(cat[`previous_${metric}`])}
                                        </div>
                                    </div>
                                    <div className="relative group">
                                        <div
                                            className="w-7 rounded-t-md transition-all duration-300"
                                            style={{ height: Math.max(curH, 3), backgroundColor: BAR_COLORS.current }}
                                        />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-foreground text-background text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                                            {periodLabel}: {formatValue(cat[`current_${metric}`])}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] font-medium text-muted-foreground mt-2 text-center leading-tight truncate w-full px-1" title={cat.name}>
                                    {cat.name.length > 10 ? cat.name.slice(0, 9) + '...' : cat.name}
                                </p>
                                <div className={cn(
                                    "text-[9px] font-bold mt-0.5",
                                    cat.growth > 0 ? "text-green-500" : cat.growth < 0 ? "text-red-500" : "text-muted-foreground"
                                )}>
                                    {cat.growth > 0 ? '+' : ''}{cat.growth}%
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_COLORS.current }} />
                    {periodLabel}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_COLORS.previous }} />
                    {prevLabel}
                </div>
                {totalCategories > data.length && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                        Showing top {data.length} of {totalCategories} categories
                    </span>
                )}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_DASHBOARD);

    const [dashboardData, setDashboardData] = useState({
        stats: null,
        chartDataRaw: []
    });
    const { stats, chartDataRaw } = dashboardData;

    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(!stats);

    const [catPeriod, setCatPeriod] = useState('month');
    const [catData, setCatData] = useState({ categories: [], period_label: '', prev_label: '', total_categories: 0 });
    const [catLimit, setCatLimit] = useState(10);

    const periods = [
        { value: 'week', label: '7 Days' },
        { value: 'month', label: '30 Days' },
        { value: 'year', label: '1 Year' }
    ];

    const catPeriods = [
        { value: 'week', label: '7 Days' },
        { value: 'month', label: '30 Days' },
        { value: 'year', label: '1 Year' }
    ];

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [summaryRes, chartRes] = await Promise.all([
                api.get('/sales/summary'),
                api.get('/reports/sales', { params: { period } })
            ]);
            setDashboardData({
                stats: summaryRes.data.data,
                chartDataRaw: chartRes.data.data?.chart_data || []
            });
        } catch (err) {
            console.error('Failed to fetch dashboard data', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchCategorySales = async () => {
        try {
            const res = await api.get('/reports/category-sales', { params: { period: catPeriod, limit: catLimit } });
            const d = res.data?.data || {};
            setCatData({
                categories: d.categories || [],
                period_label: d.period_label || '',
                prev_label: d.prev_label || '',
                total_categories: d.total_categories || 0,
            });
        } catch (err) {
            console.error('Failed to fetch category sales', err);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchData(!!dashboardData.stats);
        }, 300);
        return () => { clearTimeout(debounce); isMounted = false; };
    }, [period, refreshTrigger]);

    useEffect(() => {
        fetchCategorySales();
    }, [catPeriod, catLimit, refreshTrigger]);

    const formatCurr = (val) => new Intl.NumberFormat('en-PH', { 
        style: 'currency', 
        currency: 'PHP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val || 0);

    const chartData = useMemo(() => {
        return chartDataRaw.map(d => {
            let label = d.date?.split('-').pop();
            if (period === 'year') {
                const date = new Date(d.date);
                label = date.toLocaleString('default', { month: 'short' });
            }
            return {
                label,
                value: Number(d.orders) || 0,
                fullDate: d.date
            };
        });
    }, [chartDataRaw, period]);

    const maxOrders = useMemo(() => Math.max(...chartData.map(d => d.value), 5), [chartData]);

    if (loading && !stats) return (
        <div className="flex items-center justify-center py-32">
            <div className="spinner" />
        </div>
    );

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight">Dashboard Overview</h2>
                    <p className="text-sm text-muted-foreground mt-1">Real-time insights into your business performance.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link to="/inventory/sales">View All Orders</Link>
                    </Button>
                    <Button asChild>
                        <Link to="/reports">View Reports</Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
                <StatCard 
                    label="Today's Revenue" 
                    value={stats?.total_revenue ? formatCurr(stats.total_revenue) : '₱0'} 
                    trend="Live" trendUp={true} 
                    icon={PhilippinePeso} accentColor="green" 
                />
                <StatCard 
                    label="Orders Today" 
                    value={stats?.orders_today || 0} 
                    trend="New" trendUp={true} 
                    icon={ShoppingBag} accentColor="blue" 
                />
                <StatCard 
                    label="Low Stock Items" 
                    value={stats?.low_stock_count || 0} 
                    trend="Required" trendUp={false} 
                    icon={AlertTriangle} accentColor="amber" 
                />
                <StatCard 
                    label="Active Riders" 
                    value={stats?.active_riders || 0} 
                    trend="Available" trendUp={true} 
                    icon={Bike} accentColor="accent" 
                />
            </div>

            <Card className="p-0 mb-5 overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-1">
                    <h3 className="text-sm font-bold text-foreground">Order Scaling</h3>
                    <div className="flex gap-1 rounded-lg bg-secondary p-1">
                        {periods.map(p => (
                            <Button 
                                key={p.value}
                                variant={period === p.value ? "default" : "ghost"}
                                size="sm"
                                className={cn("h-7 px-3 text-[11px] font-bold", period !== p.value && "text-muted-foreground")}
                                onClick={() => setPeriod(p.value)}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </div>
                <div className="px-2 pb-2" style={{ height: 280 }}>
                    <LineChart 
                        data={chartData} 
                        maxValue={maxOrders} 
                        formatValue={(v) => `${v} Orders`}
                        title=""
                        totalValueLabel="Total Success Orders"
                        color="#3b82f6"
                    />
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-primary" />
                                Revenue by Category
                            </h3>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Compare sales revenue across top categories</p>
                        </div>
                        <div className="flex gap-1 rounded-lg bg-secondary p-1">
                            {catPeriods.map(p => (
                                <Button
                                    key={p.value}
                                    variant={catPeriod === p.value ? "default" : "ghost"}
                                    size="sm"
                                    className={cn("h-6 px-2 text-[10px] font-bold", catPeriod !== p.value && "text-muted-foreground")}
                                    onClick={() => setCatPeriod(p.value)}
                                >
                                    {p.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <CategoryBarChart
                        data={catData.categories}
                        periodLabel={catData.period_label}
                        prevLabel={catData.prev_label}
                        metric="revenue"
                        formatValue={formatCurr}
                        totalCategories={catData.total_categories}
                    />
                    {catData.total_categories > catLimit && (
                        <div className="flex justify-center mt-3">
                            <Button variant="ghost" size="sm" className="text-[11px] text-primary" onClick={() => setCatLimit(prev => Math.min(prev + 10, 50))}>
                                Show more categories
                            </Button>
                        </div>
                    )}
                </Card>

                <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-blue-500" />
                                Units Sold by Category
                            </h3>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Compare quantity of items sold per category</p>
                        </div>
                    </div>
                    <CategoryBarChart
                        data={catData.categories}
                        periodLabel={catData.period_label}
                        prevLabel={catData.prev_label}
                        metric="units"
                        formatValue={(v) => `${v} units`}
                        totalCategories={catData.total_categories}
                    />
                    <div className="mt-3 space-y-1.5">
                        {catData.categories.slice(0, 3).map(cat => (
                            <div key={cat.id} className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground truncate mr-2">{cat.name}</span>
                                <Badge variant="outline" className={cn(
                                    "text-[9px] px-1.5 shrink-0",
                                    cat.growth > 0 ? "text-green-600 border-green-200 bg-green-50" :
                                    cat.growth < 0 ? "text-red-600 border-red-200 bg-red-50" :
                                    "text-muted-foreground"
                                )}>
                                    {cat.growth > 0 ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : cat.growth < 0 ? <TrendingDown className="h-2.5 w-2.5 mr-0.5" /> : null}
                                    {cat.growth > 0 ? '+' : ''}{cat.growth}%
                                </Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
