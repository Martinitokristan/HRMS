import React, { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import StatCard from '../shared/StatCard';
import { StatusBadge } from '../shared/Badge';
import LineChart from '../shared/LineChart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Download, Loader2, PhilippinePeso, Package, TrendingUp, Target, CheckCircle2, Clock, Truck, XCircle, CreditCard, Banknote, Trophy, Medal } from 'lucide-react';

// Removed inline LineChart definition since it's now a shared component

// End of LineChart removal


// Product Sales Chart - Horizontal Bar Chart
const ProductSalesChart = ({ data, formatValue, color = '#f97316' }) => {
    if (!data || data.length === 0) return null;
    
    const maxValue = Math.max(...data.map(d => Number(d.total_sold)), 1);
    const totalSold = data.reduce((sum, d) => sum + Number(d.total_sold), 0);
    
    // Sort by total_sold descending and take top 8
    const sortedData = [...data].sort((a, b) => Number(b.total_sold) - Number(a.total_sold)).slice(0, 8);
    
    return (
        <div className="line-chart-wrapper">
            <div className="chart-header-row">
                <span className="chart-title">Top Product Sales</span>
                <div className="chart-total">
                    <span className="chart-total-value">{formatValue(totalSold)}</span>
                    <span className="chart-total-label">Total Units Sold</span>
                </div>
            </div>
            <div className="chart-svg-container">
                <div className="horizontal-bar-chart">
                    {sortedData.map((product, idx) => {
                        const widthPct = (Number(product.total_sold) / maxValue) * 100;
                        return (
                            <div key={product.id} className="bar-row">
                                <div className="bar-label" title={product.name}>
                                    {product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name}
                                </div>
                                <div className="bar-track">
                                    <div 
                                        className="bar-fill"
                                        style={{ 
                                            width: `${Math.max(widthPct, 2)}%`,
                                            background: color
                                        }}
                                    >
                                        <span className="bar-value">{formatValue(product.total_sold)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const MiniStat = ({ label, value, icon, trend, trendUp }) => (
    <Card className="p-4">
        <div className="flex items-center gap-3">
            <div className="text-2xl">{icon}</div>
            <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="text-lg font-bold text-foreground">{value}</div>
                {trend && (
                    <div className={`text-xs font-semibold ${trendUp ? 'text-success-foreground' : 'text-destructive'}`}>
                        {trendUp ? '↑' : '↓'} {Math.abs(trend)}%
                    </div>
                )}
            </div>
        </div>
    </Card>
);

const MetricCard = ({ title, value, total, color, icon }) => {
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" style={{ color }}>{icon}</span>
                <span className="text-sm font-semibold text-muted-foreground">{title}</span>
            </div>
            <div className="text-2xl font-bold mb-2" style={{ color }}>{value}</div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, background: color }} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">{percentage}% of total</div>
        </Card>
    );
};

export default function Reports() {
    const { refreshTrigger } = useSilentRefresh('admin_dashboard');
    const [period, setPeriod] = useState('month');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [topProducts, setTopProducts] = useState([]);

    const periods = [
        { value: 'week', label: 'Last 7 Days', short: '7D' },
        { value: 'month', label: 'Last 30 Days', short: '30D' },
        { value: 'quarter', label: 'Last Quarter', short: '90D' },
        { value: 'year', label: 'Last 12 Months', short: '1Y' }
    ];

    useEffect(() => {
        let isMounted = true;
        
        const fetchReport = async () => {
            setLoading(true);
            try {
                const res = await api.get('/reports/sales', { params: { period } });
                if (isMounted) setReport(res.data.data !== undefined ? res.data.data : res.data);
            } catch (err) {
                console.error('Failed to fetch report');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const fetchTopProducts = async () => {
            try {
                const res = await api.get('/reports/top-products', { params: { period } });
                const data = res.data?.data !== undefined ? res.data.data : res.data;
                if (isMounted) setTopProducts(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch top products');
            }
        };

        fetchReport();
        fetchTopProducts();
        return () => { isMounted = false; };
    }, [period, refreshTrigger]);

    const formatCurr = (val) => {
        return new Intl.NumberFormat('en-PH', { 
            style: 'currency', 
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    const formatNumber = (val) => new Intl.NumberFormat('en-PH').format(val || 0);

    const downloadPDF = async () => {
        setExporting(true);
        try {
            const res = await api.get('/reports/export', { 
                params: { period, type: 'pdf' },
                responseType: 'blob' 
            });

            // Check if response is JSON error (backend error)
            if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
                // Convert blob to text to read error message
                const text = await res.data.text();
                const errorData = JSON.parse(text);
                console.error('PDF Generation Error:', errorData);
                alert(errorData.message || 'Failed to generate PDF report. Please try again.');
                return;
            }

            // Check if response is actual PDF
            if (res.headers['content-type'] && res.headers['content-type'].includes('application/pdf')) {
                const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `sales_report_${period}_${new Date().toISOString().split('T')[0]}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode.removeChild(link);
                // Clean up the URL object
                window.URL.revokeObjectURL(url);
            } else {
                console.error('Unexpected response type:', res.headers['content-type']);
                alert('Unexpected response from server. Please try again.');
            }
        } catch (e) {
            console.error('PDF Export failed:', e);
            if (e.response && e.response.data) {
                // Handle JSON error response
                try {
                    const errorText = await e.response.data.text();
                    const errorData = JSON.parse(errorText);
                    alert(errorData.message || 'Failed to generate PDF report. Please try again.');
                } catch (parseError) {
                    alert('Failed to generate PDF report. Please try again.');
                }
            } else {
                alert('Failed to download PDF report. Please check your connection and try again.');
            }
        } finally {
            setExporting(false);
        }
    };

    const chartData = useMemo(() => {
        if (!report?.chart_data) return [];
        return report.chart_data.map(d => ({
            label: d.date?.split('-').pop(),
            value: Number(d.revenue) || 0,
            orders: Number(d.orders) || 0,
            fullDate: d.date
        }));
    }, [report]);

    const maxRevenue = useMemo(() => Math.max(...chartData.map(d => d.value), 1), [chartData]);
    const summary = report?.summary || {};
    const totalOrders = summary.total_orders || 0;

    if (loading || !report) {
        return (
            <div>
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-primary" /> Reports & Analytics
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Loading your business insights...</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-[120px] rounded-xl bg-secondary animate-pulse" />)}
                </div>
                <div className="h-[300px] rounded-xl bg-secondary animate-pulse" />
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-primary" /> Reports & Analytics
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Track performance, analyze trends, and make data-driven decisions</p>
                </div>
                <Button onClick={downloadPDF} disabled={exporting} className="gap-2">
                    {exporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Download className="h-4 w-4" /> Download PDF Report</>}
                </Button>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
                {periods.map(p => (
                    <Button
                        key={p.value}
                        variant={period === p.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod(p.value)}
                    >
                        <span className="font-bold mr-1.5">{p.short}</span>
                        <span className="hidden sm:inline">{p.label}</span>
                    </Button>
                ))}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Revenue" value={formatCurr(summary.total_revenue)} icon={PhilippinePeso} accentColor="green" trend={summary.revenue_change} trendUp={summary.revenue_change >= 0} />
                <StatCard label="Total Orders" value={formatNumber(summary.total_orders)} icon={Package} accentColor="blue" trend={summary.orders_change} trendUp={summary.orders_change >= 0} />
                <StatCard label="Average Order Value" value={formatCurr(summary.average_order_value)} icon={TrendingUp} accentColor="purple" trend={summary.aov_change} trendUp={summary.aov_change >= 0} />
                <StatCard label="Conversion Rate" value={`${(summary.conversion_rate || 0).toFixed(1)}%`} icon={Target} accentColor="amber" />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} className="mb-6">
                <TabsList>
                    <TabsTrigger value="overview" onClick={() => setActiveTab('overview')} className="gap-1.5">Overview</TabsTrigger>
                    <TabsTrigger value="trends" onClick={() => setActiveTab('trends')} className="gap-1.5">Trends</TabsTrigger>
                    <TabsTrigger value="products" onClick={() => setActiveTab('products')} className="gap-1.5">Top Products</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Tab Content */}
            <div>
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard title="Delivered" value={summary.delivered_orders || 0} total={totalOrders} color="#22C55E" icon={<CheckCircle2 className="h-5 w-5" />} />
                            <MetricCard title="Pending" value={summary.pending_orders || 0} total={totalOrders} color="#F59E0B" icon={<Clock className="h-5 w-5" />} />
                            <MetricCard title="In Progress" value={summary.in_progress_orders || 0} total={totalOrders} color="#3B82F6" icon={<Truck className="h-5 w-5" />} />
                            <MetricCard title="Failed" value={summary.failed_orders || 0} total={totalOrders} color="#EF4444" icon={<XCircle className="h-5 w-5" />} />
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment Method</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Card className="bg-secondary/30 p-4 flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                                        <Banknote className="h-6 w-6 text-amber-500" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-foreground">Cash on Delivery</div>
                                        <div className="text-sm text-muted-foreground">{summary.cod_orders || 0} orders</div>
                                        <div className="text-lg font-bold text-primary">{formatCurr(summary.cod_revenue || 0)}</div>
                                    </div>
                                </Card>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'trends' && (
                    <div className="space-y-6">
                        <Card className="p-4">
                            <LineChart 
                                data={chartData} 
                                maxValue={maxRevenue}
                                formatValue={formatCurr}
                                title="Revenue Trend"
                                totalValueLabel="Total Revenue"
                                color="#f97316"
                            />
                        </Card>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MiniStat label="Highest Daily Revenue" value={formatCurr(Math.max(...chartData.map(d => d.value), 0))} icon={<BarChart3 className="h-4 w-4" />} />
                            <MiniStat label="Average Daily" value={formatCurr(summary.total_revenue / (chartData.length || 1))} icon={<TrendingUp className="h-4 w-4" />} />
                            <MiniStat label="Peak Orders Day" value={`${Math.max(...chartData.map(d => d.orders), 0)} orders`} icon={<Target className="h-4 w-4" />} />
                            <MiniStat label="Active Days" value={`${chartData.filter(d => d.value > 0).length} days`} icon={<Clock className="h-4 w-4" />} />
                        </div>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="space-y-6">
                        <Card className="p-4">
                            <ProductSalesChart 
                                data={topProducts} 
                                formatValue={(val) => `${val} units`}
                                color="#f97316"
                            />
                        </Card>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top Performing Products</h3>
                        <div className="space-y-2">
                            {topProducts.length === 0 ? (
                                <Card className="p-8 text-center">
                                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">No product data available for this period</p>
                                </Card>
                            ) : (
                                topProducts.map((product, idx) => (
                                    <Card key={product.id} className="p-4 flex items-center gap-4">
                                        <div className="w-8 text-center shrink-0">
                                            {idx === 0 && <Trophy className="h-5 w-5 text-amber-400 mx-auto" />}
                                            {idx === 1 && <Medal className="h-5 w-5 text-slate-400 mx-auto" />}
                                            {idx === 2 && <Medal className="h-5 w-5 text-orange-400 mx-auto" />}
                                            {idx > 2 && <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-foreground truncate">{product.name}</div>
                                            <div className="text-[12px] text-muted-foreground">Barcode: {product.barcode}</div>
                                        </div>
                                        <div className="flex items-center gap-6 shrink-0">
                                            <div className="text-right">
                                                <div className="text-[11px] text-muted-foreground uppercase">Sales</div>
                                                <div className="font-bold text-foreground">{product.total_sold} units</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[11px] text-muted-foreground uppercase">Revenue</div>
                                                <div className="font-bold text-primary">{formatCurr(product.revenue)}</div>
                                            </div>
                                            {idx < 3 && <Badge className="bg-destructive/10 text-destructive border-destructive/20" variant="outline">🔥 Hot</Badge>}
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <span className="text-[11px] text-muted-foreground">📅 Period: {periods.find(p => p.value === period)?.label}</span>
                <span className="text-[11px] text-muted-foreground">🔄 Updated: {new Date().toLocaleTimeString()}</span>
            </div>
        </div>
    );
}
