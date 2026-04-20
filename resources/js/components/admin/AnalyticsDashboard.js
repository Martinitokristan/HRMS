import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Users,
    Package,
    Star,
    ArrowUp,
    ArrowDown,
    Calendar,
    Download,
} from "lucide-react";
import api from "../../lib/api";
import { useSilentRefresh } from "../../hooks/useSilentRefresh";

export default function AnalyticsDashboard() {
    const { refreshTrigger } = useSilentRefresh("admin_dashboard");
    const [period, setPeriod] = useState("month");
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        sales: null,
        topProducts: null,
        customerBehavior: null,
        inventoryForecast: null,
        profitMargins: null,
    });

    useEffect(() => {
        fetchAnalytics();
    }, [period, refreshTrigger]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const [
                salesRes,
                topProductsRes,
                customerBehaviorRes,
                inventoryRes,
                profitRes,
            ] = await Promise.all([
                api.get(`/reports/sales?period=${period}`),
                api.get(`/reports/top-products?period=${period}`),
                api.get("/analytics/customer-behavior"),
                api.get("/analytics/inventory-forecast"),
                api.get("/analytics/profit-margins"),
            ]);

            const salesPayload = salesRes.data?.data || {};
            const salesSummary = salesPayload.summary || {};

            setData({
                sales: salesSummary,
                topProducts: topProductsRes.data.data,
                customerBehavior: customerBehaviorRes.data.data,
                inventoryForecast: inventoryRes.data.data,
                profitMargins: profitRes.data.data,
            });
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportReport = async (type) => {
        try {
            const response = await api.get(
                `/reports/export?type=${type}&period=${period}`,
                {
                    responseType: "blob",
                },
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `${type}-report-${period}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Failed to export report:", error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
        }).format(amount);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat("en-PH").format(num);
    };

    const getChangeIcon = (value) => {
        return value >= 0 ? ArrowUp : ArrowDown;
    };

    const getChangeColor = (value) => {
        return value >= 0 ? "text-green-600" : "text-red-600";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
                <div className="flex items-center gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">Last Week</SelectItem>
                            <SelectItem value="month">Last Month</SelectItem>
                            <SelectItem value="year">Last Year</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        onClick={() => exportReport("sales")}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Total Revenue
                                </p>
                                <p className="text-2xl font-bold">
                                    {data.sales
                                        ? formatCurrency(
                                              data.sales.total_revenue,
                                          )
                                        : "₱0"}
                                </p>
                                {data.sales?.revenue_change && (
                                    <div
                                        className={`flex items-center text-sm ${getChangeColor(data.sales.revenue_change)}`}
                                    >
                                        {React.createElement(
                                            getChangeIcon(
                                                data.sales.revenue_change,
                                            ),
                                            { className: "w-3 h-3 mr-1" },
                                        )}
                                        {Math.abs(data.sales.revenue_change)}%
                                    </div>
                                )}
                            </div>
                            <DollarSign className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Total Orders
                                </p>
                                <p className="text-2xl font-bold">
                                    {data.sales
                                        ? formatNumber(data.sales.total_orders)
                                        : "0"}
                                </p>
                                {data.sales?.orders_change && (
                                    <div
                                        className={`flex items-center text-sm ${getChangeColor(data.sales.orders_change)}`}
                                    >
                                        {React.createElement(
                                            getChangeIcon(
                                                data.sales.orders_change,
                                            ),
                                            { className: "w-3 h-3 mr-1" },
                                        )}
                                        {Math.abs(data.sales.orders_change)}%
                                    </div>
                                )}
                            </div>
                            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Active Customers
                                </p>
                                <p className="text-2xl font-bold">
                                    {data.customerBehavior
                                        ? formatNumber(
                                              data.customerBehavior
                                                  .active_customers,
                                          )
                                        : "0"}
                                </p>
                                <div className="flex items-center text-sm text-green-600">
                                    <ArrowUp className="w-3 h-3 mr-1" />
                                    12.5%
                                </div>
                            </div>
                            <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Avg. Order Value
                                </p>
                                <p className="text-2xl font-bold">
                                    {data.sales
                                        ? formatCurrency(
                                              data.sales.average_order_value,
                                          )
                                        : "₱0"}
                                </p>
                                <div className="flex items-center text-sm text-green-600">
                                    <ArrowUp className="w-3 h-3 mr-1" />
                                    8.2%
                                </div>
                            </div>
                            <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Top Products */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Top Selling Products
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.topProducts
                                ?.slice(0, 5)
                                .map((product, index) => (
                                    <div
                                        key={product.id}
                                        className="flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <div className="font-medium">
                                                    {product.name}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {product.total_sold} sold
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">
                                                {formatCurrency(
                                                    product.total_revenue,
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                Revenue
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Customer Behavior */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Customer Behavior
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span>Repeat Purchase Rate</span>
                                <Badge variant="secondary">
                                    {data.customerBehavior
                                        ?.repeat_purchase_rate || 0}
                                    %
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Avg. Items per Order</span>
                                <Badge variant="secondary">
                                    {data.customerBehavior
                                        ?.avg_items_per_order || 0}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Cart Abandonment Rate</span>
                                <Badge
                                    variant={
                                        data.customerBehavior
                                            ?.cart_abandonment_rate > 30
                                            ? "destructive"
                                            : "secondary"
                                    }
                                >
                                    {data.customerBehavior
                                        ?.cart_abandonment_rate || 0}
                                    %
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Customer Satisfaction</span>
                                <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                    <span>
                                        {data.customerBehavior
                                            ?.avg_satisfaction || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Inventory Forecast */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Inventory Forecast
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                                {data.inventoryForecast?.low_stock_items || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Low Stock Items
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">
                                {data.inventoryForecast?.out_of_stock_items ||
                                    0}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Out of Stock
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {data.inventoryForecast?.overstock_items || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Overstock Items
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Profit Margins */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Profit Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <div className="text-sm text-muted-foreground">
                                Gross Profit Margin
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                                {data.profitMargins?.gross_profit_margin || 0}%
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">
                                Net Profit Margin
                            </div>
                            <div className="text-2xl font-bold text-blue-600">
                                {data.profitMargins?.net_profit_margin || 0}%
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">
                                Total Profit
                            </div>
                            <div className="text-2xl font-bold">
                                {data.profitMargins
                                    ? formatCurrency(
                                          data.profitMargins.total_profit,
                                      )
                                    : "₱0"}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">
                                Operating Expenses
                            </div>
                            <div className="text-2xl font-bold text-red-600">
                                {data.profitMargins
                                    ? formatCurrency(
                                          data.profitMargins.operating_expenses,
                                      )
                                    : "₱0"}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
