import React, { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import { Link } from 'react-router-dom';
import StatCard from '../shared/StatCard';
import LineChart from '../shared/LineChart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PhilippinePeso, ShoppingBag, AlertTriangle, Bike, TrendingUp, BarChart3 } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { STALE_KEYS } from '../../store/dataStore';

export default function Dashboard() {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_DASHBOARD);

    const [dashboardData, setDashboardData] = useState({
        stats: null,
        chartDataRaw: []
    });
    const { stats, chartDataRaw } = dashboardData;

    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(!stats);

    const [yearlyCategories, setYearlyCategories] = useState([]);
    const [returnRateData, setReturnRateData] = useState([]);

    const periods = [
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

    const fetchYearlyCategories = async () => {
        try {
            const res = await api.get('/reports/yearly-category-revenue', { params: { limit: 10 } });
            setYearlyCategories(res.data?.data?.categories || []);
        } catch (err) {
            console.error('Failed to fetch yearly category revenue', err);
        }
    };

    const fetchReturnRate = async () => {
        try {
            const res = await api.get('/reports/return-rate-by-category', { params: { limit: 10 } });
            setReturnRateData(res.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch return rate by category', err);
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
        fetchYearlyCategories();
        fetchReturnRate();
    }, [refreshTrigger]);

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
                {/* Revenue by Category — Full Year */}
                <Card className="p-5">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Revenue by Category
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Top 10 categories · {new Date().getFullYear()} (Jan – Dec)</p>
                    </div>
                    {yearlyCategories.length === 0 ? (
                        <div className="flex items-center justify-center h-[220px] text-muted-foreground">
                            <div className="text-center">
                                <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No category data for this year</p>
                            </div>
                        </div>
                    ) : (() => {
                        const maxRev = Math.max(...yearlyCategories.map(c => Number(c.revenue)), 1);
                        return (
                            <div className="space-y-2.5">
                                {yearlyCategories.map((cat, idx) => (
                                    <div key={cat.id || idx}>
                                        <div className="flex justify-between text-[11px] mb-1">
                                            <span className="font-medium text-foreground truncate mr-2" title={cat.name}>
                                                {cat.name.length > 18 ? cat.name.slice(0, 17) + '…' : cat.name}
                                            </span>
                                            <span className="text-muted-foreground shrink-0">{formatCurr(cat.revenue)}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all duration-500"
                                                style={{ width: `${(Number(cat.revenue) / maxRev) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </Card>

                {/* Return Rate by Category — Line Chart */}
                <Card className="p-5">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-red-500" />
                            Return Rate by Category
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Which categories are returned most often</p>
                    </div>
                    {returnRateData.length === 0 ? (
                        <div className="flex items-center justify-center h-[220px] text-muted-foreground">
                            <div className="text-center">
                                <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No return data available</p>
                            </div>
                        </div>
                    ) : (
                        <div className="px-2 pb-2" style={{ height: 220 }}>
                            <LineChart
                                data={returnRateData.map(c => ({ label: c.name.length > 8 ? c.name.slice(0, 7) + '…' : c.name, value: c.return_rate, fullName: c.name }))}
                                maxValue={Math.max(...returnRateData.map(c => c.return_rate), 1)}
                                formatValue={(v) => `${v}%`}
                                title=""
                                totalValueLabel="Avg Return Rate"
                                color="#ef4444"
                                hideHeader={true}
                            />
                        </div>
                    )}
                    {returnRateData.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                            {returnRateData.slice(0, 3).map(cat => (
                                <div key={cat.id} className="flex items-center justify-between text-[11px]">
                                    <span className="text-muted-foreground truncate mr-2">{cat.name}</span>
                                    <Badge variant="outline" className="text-[9px] px-1.5 shrink-0 text-red-600 border-red-200 bg-red-50">
                                        <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                                        {cat.return_rate}%
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
