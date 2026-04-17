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
} from "lucide-react";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";
import { STALE_KEYS } from "../../store/dataStore";

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Revenue by Category — Full Year */}
                <Card className="p-5">
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
                    {yearlyCategories.length === 0 ? (
                        <div className="flex items-center justify-center h-[220px] text-muted-foreground">
                            <div className="text-center">
                                <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">
                                    No category data for this year
                                </p>
                            </div>
                        </div>
                    ) : (
                        (() => {
                            const maxRev = Math.max(
                                ...yearlyCategories.map((c) =>
                                    Number(c.revenue),
                                ),
                                1,
                            );
                            return (
                                <div className="flex items-end justify-around h-[200px] mt-6">
                                    {yearlyCategories.map((cat, idx) => (
                                        <div
                                            key={cat.id || idx}
                                            className="flex flex-col items-center gap-1.5 w-[10%] min-w-[30px] h-full justify-end group cursor-pointer"
                                        >
                                            <div className="text-[10px] text-muted-foreground font-medium mb-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatCurr(cat.revenue)}
                                            </div>
                                            <div className="w-full max-w-[32px] rounded-t-md bg-secondary flex-1 flex flex-col justify-end overflow-hidden">
                                                <div
                                                    className="w-full bg-primary transition-all duration-500"
                                                    style={{
                                                        height: `${(Number(cat.revenue) / maxRev) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <div className="mt-1 h-6 flex items-center justify-center">
                                                <span
                                                    className="text-[10px] font-medium text-muted-foreground text-center truncate w-full px-1"
                                                    title={cat.name}
                                                >
                                                    {cat.name.split(" ")[0]}{" "}
                                                    {/* Keep it clean */}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    )}
                </Card>

                {/* Return Rate by Category — Line Chart */}
                <Card className="p-5">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-red-500" />
                            Return Rate by Category
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Which categories are returned most often
                        </p>
                    </div>
                    {returnRateData.length === 0 ? (
                        <div className="flex items-center justify-center h-[220px] text-muted-foreground">
                            <div className="text-center">
                                <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">
                                    No return data available
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="space-y-4 mt-4 h-[220px] overflow-y-auto pr-2"
                            style={{ scrollbarWidth: "thin" }}
                        >
                            {returnRateData.slice(0, 10).map((cat, idx) => (
                                <div
                                    key={cat.id || idx}
                                    className="flex items-center gap-3"
                                >
                                    <div className="w-24 shrink-0 text-right">
                                        <span
                                            className="text-[11px] font-medium text-foreground block truncate"
                                            title={cat.name}
                                        >
                                            {cat.name}
                                        </span>
                                    </div>
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="h-2.5 rounded-full bg-secondary w-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-red-500 transition-all duration-500"
                                                style={{
                                                    width: `${Math.min(cat.return_rate, 100)}%`,
                                                }}
                                            />
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] w-12 justify-center px-1 shrink-0 text-red-600 border-red-200 bg-red-50"
                                        >
                                            {cat.return_rate}%
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
