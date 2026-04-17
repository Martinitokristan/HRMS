import React, { useState, useEffect, useMemo } from "react";
import api from "../../lib/api";
import { Link } from "react-router-dom";
import StatCard from "../shared/StatCard";
import LineChart from "../shared/LineChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    PhilippinePeso,
    ShoppingBag,
    AlertTriangle,
    Bike,
    TrendingUp,
    BarChart3,
    CheckCircle,
    Package,
    RefreshCcw,
    Clock,
    Check,
} from "lucide-react";
import BarChart from "../shared/BarChart";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { STALE_KEYS } from "../../store/dataStore";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_DASHBOARD);

    const [dashboardData, setDashboardData] = useState({
        stats: null,
        chartDataRaw: [],
    });
    const { stats, chartDataRaw } = dashboardData;

    const [period, setPeriod] = useState("month");
    const [loading, setLoading] = useState(!stats);

    const [yearlyCategories, setYearlyCategories] = useState([]);
    const [returnRateData, setReturnRateData] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);

    const periods = [
        { value: "week", label: "7 Days" },
        { value: "month", label: "30 Days" },
        { value: "year", label: "1 Year" },
    ];

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [summaryRes, chartRes] = await Promise.all([
                api.get("/sales/summary"),
                api.get("/reports/sales", { params: { period } }),
            ]);
            setDashboardData({
                stats: summaryRes.data.data,
                chartDataRaw: chartRes.data.data?.chart_data || [],
            });
        } catch (err) {
            console.error("Failed to fetch dashboard data", err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchYearlyCategories = async () => {
        try {
            const res = await api.get("/reports/yearly-category-revenue", {
                params: { limit: 10 },
            });
            setYearlyCategories(res.data?.data?.categories || []);
        } catch (err) {
            console.error("Failed to fetch yearly category revenue", err);
        }
    };

    const fetchReturnRate = async () => {
        try {
            const res = await api.get("/reports/return-rate-by-category", {
                params: { limit: 10 },
            });
            setReturnRateData(res.data?.data || []);
        } catch (err) {
            console.error("Failed to fetch return rate by category", err);
        }
    };

    const fetchRecentActivity = async () => {
        setActivityLoading(true);
        try {
            const res = await api.get("/reports/recent-activity");
            setRecentActivity(res.data?.data || []);
        } catch (err) {
            console.error("Failed to fetch recent activity", err);
        } finally {
            setActivityLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchData(!!dashboardData.stats);
        }, 300);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [period, refreshTrigger]);

    useEffect(() => {
        fetchYearlyCategories();
        fetchReturnRate();
        fetchRecentActivity();
    }, [refreshTrigger]);

    const formatCurr = (val) =>
        new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(val || 0);

    const chartData = useMemo(() => {
        return chartDataRaw.map((d) => {
            let label = d.date?.split("-").pop();
            if (period === "year") {
                const date = new Date(d.date);
                label = date.toLocaleString("default", { month: "short" });
            }
            return {
                label,
                value: Number(d.orders) || 0,
                fullDate: d.date,
            };
        });
    }, [chartDataRaw, period]);

    const maxOrders = useMemo(
        () => Math.max(...chartData.map((d) => d.value), 5),
        [chartData],
    );

    if (loading && !stats)
        return (
            <div className="flex items-center justify-center py-32">
                <div className="spinner" />
            </div>
        );

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight">
                        Dashboard Overview
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Real-time insights into your business performance.
                    </p>
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
                    value={
                        stats?.total_revenue
                            ? formatCurr(stats.total_revenue)
                            : "₱0"
                    }
                    trend="Live"
                    trendUp={true}
                    icon={PhilippinePeso}
                    accentColor="green"
                />
                <StatCard
                    label="Orders Today"
                    value={stats?.orders_today || 0}
                    trend="New"
                    trendUp={true}
                    icon={ShoppingBag}
                    accentColor="blue"
                />
                <StatCard
                    label="Low Stock Items"
                    value={stats?.low_stock_count || 0}
                    trend="Required"
                    trendUp={false}
                    icon={AlertTriangle}
                    accentColor="amber"
                />
                <StatCard
                    label="Active Riders"
                    value={stats?.active_riders || 0}
                    trend="Available"
                    trendUp={true}
                    icon={Bike}
                    accentColor="accent"
                />
            </div>

            <Card className="p-0 mb-5 overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-1">
                    <h3 className="text-sm font-bold text-foreground">
                        Order Scaling
                    </h3>
                    <div className="flex gap-1 rounded-lg bg-secondary p-1">
                        {periods.map((p) => (
                            <Button
                                key={p.value}
                                variant={
                                    period === p.value ? "default" : "ghost"
                                }
                                size="sm"
                                className={cn(
                                    "h-7 px-3 text-[11px] font-bold",
                                    period !== p.value &&
                                        "text-muted-foreground",
                                )}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue by Category — Bar Chart */}
                <Card className="p-5 flex flex-col h-[380px]">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Revenue by Category
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Top 10 categories · {new Date().getFullYear()} (Jan
                            – Dec)
                        </p>
                    </div>
                    <div className="flex-grow">
                        <BarChart
                            data={yearlyCategories.map(c => ({ label: c.name, value: c.revenue }))}
                            formatValue={formatCurr}
                            color="#3b82f6"
                            hideHeader
                        />
                    </div>
                </Card>

                {/* Return Rate by Category — Bar Chart */}
                <Card className="p-5 flex flex-col h-[380px]">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-rose-500" />
                            Return Rate by Category
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Frequency of returns per category (%)
                        </p>
                    </div>
                    <div className="flex-grow">
                        <BarChart
                            data={returnRateData.map(c => ({ label: c.name, value: c.return_rate }))}
                            formatValue={(v) => `${Number(v).toFixed(1)}%`}
                            color="#f43f5e"
                            hideHeader
                        />
                    </div>
                </Card>

                {/* Recent Activity — Live Feed */}
                <Card className="p-5 flex flex-col h-[380px]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-indigo-500" />
                            Recent Activity
                        </h3>
                        <Badge variant="outline" className="text-[10px] font-bold text-indigo-600 border-indigo-100 bg-indigo-50/50">
                            Live Feed
                        </Badge>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
                        {activityLoading && recentActivity.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-50">
                                <div className="spinner h-5 w-5 mb-2" />
                                <p className="text-xs">Updating feed...</p>
                            </div>
                        ) : recentActivity.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-50 border border-dashed rounded-xl p-4">
                                <ShoppingBag className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-xs font-medium">No recent activity</p>
                            </div>
                        ) : (
                            recentActivity.map((activity, idx) => {
                                // Dynamic icon selection
                                const IconComponent = {
                                    ShoppingBag, CheckCircle, Package, AlertTriangle, RefreshCcw, Clock, Check, Bike
                                }[activity.icon] || ShoppingBag;

                                return (
                                    <div key={activity.id || idx} className="flex gap-3 items-start group">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                                            activity.status === 'Delivered' || activity.status === 'Paid' ? "bg-green-100 text-green-600" :
                                            activity.status === 'Alert' ? "bg-rose-100 text-rose-600" :
                                            activity.status === 'In Transit' || activity.status === 'Processing' ? "bg-blue-100 text-blue-600" :
                                            "bg-amber-100 text-amber-600"
                                        )}>
                                            <IconComponent className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0 border-b border-slate-50 pb-3 group-last:border-0">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <h4 className="text-[11px] font-bold text-slate-700 truncate">
                                                    {activity.title}
                                                </h4>
                                                <span className="text-[9px] font-medium text-slate-400 shrink-0 capitalize">
                                                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 line-clamp-1 mb-2">
                                                {activity.message}
                                            </p>
                                            <Badge 
                                                className={cn(
                                                    "text-[8px] h-4 px-1.5 font-bold uppercase tracking-wider",
                                                    activity.status === 'Delivered' || activity.status === 'Paid' ? "bg-green-50 text-green-700 border-green-100" :
                                                    activity.status === 'Alert' ? "bg-rose-50 text-rose-700 border-rose-100" :
                                                    activity.status === 'In Transit' || activity.status === 'Processing' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                    "bg-amber-50 text-amber-700 border-amber-100"
                                                )}
                                                variant="outline"
                                            >
                                                {activity.status}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-50 text-center">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors" asChild>
                            <Link to="/inventory/sales">View Detailed History</Link>
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
