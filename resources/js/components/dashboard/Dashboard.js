import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Responsive, WidthProvider } from 'react-grid-layout';
import StatCard from '../shared/StatCard';
import LineChart from '../shared/LineChart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [chartDataRaw, setChartDataRaw] = useState([]);
    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(true);
    
    // Load saved layout or use defaults
    const [layouts, setLayouts] = useState(() => {
        const saved = localStorage.getItem('dashboard_layout');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error('Error parsing layout', e); }
        }
        
        // Define clean, spacious default layout coordinates
        const defaultLayout = [
            { i: 'rev', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
            { i: 'ord', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
            { i: 'stk', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
            { i: 'rid', x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
            { i: 'chart', x: 0, y: 2, w: 12, h: 6, minW: 2, minH: 4 }
        ];
        
        return { lg: defaultLayout, md: defaultLayout, sm: defaultLayout };
    });

    const periods = [
        { value: 'week', label: '7 Days' },
        { value: 'month', label: '30 Days' },
        { value: 'year', label: '1 Year' }
    ];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [summaryRes, chartRes] = await Promise.all([
                    axios.get('/sales/summary'),
                    axios.get('/reports/sales', { params: { period } })
                ]);
                setStats(summaryRes.data.data);
                setChartDataRaw(chartRes.data.data?.chart_data || []);
            } catch (err) {
                console.error('Failed to fetch dashboard data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [period]);

    const formatCurr = (val) => new Intl.NumberFormat('en-PH', { 
        style: 'currency', 
        currency: 'PHP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val || 0);

    const chartData = useMemo(() => {
        return chartDataRaw.map(d => {
            let label = d.date?.split('-').pop(); // Default day
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

    const handleLayoutChange = (layout, allLayouts) => {
        setLayouts(allLayouts);
        localStorage.setItem('dashboard_layout', JSON.stringify(allLayouts));
    };

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

            <div className="-mx-3">
                <ResponsiveGridLayout
                    className="layout"
                    layouts={layouts}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={80}
                    onLayoutChange={handleLayoutChange}
                    draggableHandle=".drag-handle"
                    margin={[20, 20]}
                >
                    <div key="rev" className="widget-wrap">
                        <div className="drag-handle" title="Drag to move" />
                        <StatCard 
                            label="Today's Revenue" 
                            value={stats?.total_revenue ? formatCurr(stats.total_revenue) : '₱0'} 
                            trend="Live" trendUp={true} 
                            icon="💰" accentColor="green" 
                        />
                    </div>
                    
                    <div key="ord" className="widget-wrap">
                        <div className="drag-handle" title="Drag to move" />
                        <StatCard 
                            label="Orders Today" 
                            value={stats?.orders_today || 0} 
                            trend="New" trendUp={true} 
                            icon="🏷️" accentColor="blue" 
                        />
                    </div>

                    <div key="stk" className="widget-wrap">
                        <div className="drag-handle" title="Drag to move" />
                        <StatCard 
                            label="Low Stock Items" 
                            value={stats?.low_stock_count || 0} 
                            trend="Required" trendUp={false} 
                            icon="⚠️" accentColor="amber" 
                        />
                    </div>

                    <div key="rid" className="widget-wrap">
                        <div className="drag-handle" title="Drag to move" />
                        <StatCard 
                            label="Active Riders" 
                            value={stats?.active_riders || 0} 
                            trend="Available" trendUp={true} 
                            icon="🛵" accentColor="accent" 
                        />
                    </div>

                    <div key="chart" className="widget-wrap !pt-2">
                        <div className="drag-handle" title="Drag to move" />
                        <div className="flex h-full flex-col">
                            <div className="flex items-center justify-between px-5 pt-4 pb-1">
                                <h3 className="text-sm font-bold text-foreground">Order Scaling</h3>
                                <div className="flex gap-1 rounded-lg bg-secondary p-1" onMouseDown={(e) => e.stopPropagation()}>
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
                            <div className="flex-1 relative min-h-0">
                                <LineChart 
                                    data={chartData} 
                                    maxValue={maxOrders} 
                                    formatValue={(v) => `${v} Orders`}
                                    title=""
                                    totalValueLabel="Total Success Orders"
                                    color="#3b82f6"
                                />
                            </div>
                        </div>
                    </div>
                </ResponsiveGridLayout>
            </div>

            <style>{`
                .widget-wrap {
                    background: white;
                    border-radius: 16px;
                    border: 1px solid #E2E8F0;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    transition: box-shadow 0.2s;
                    overflow: hidden;
                }
                .widget-wrap:hover {
                    box-shadow: 0 8px 25px rgba(0,0,0,0.08);
                }
                .widget-wrap > .stat-card {
                    border: none !important;
                    box-shadow: none !important;
                    height: 100%;
                    width: 100%;
                    padding-top: 1.5rem;
                }
                .drag-handle {
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 22px;
                    cursor: grab;
                    z-index: 10;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .drag-handle::after {
                    content: '⋯';
                    color: #94a3b8;
                    font-size: 16px;
                    letter-spacing: 2px;
                }
                .widget-wrap:hover .drag-handle {
                    opacity: 1;
                    background: linear-gradient(to bottom, rgba(248,250,252,0.9), transparent);
                }
                .drag-handle:active { cursor: grabbing; }
                .chart-wrapper-inner,
                .widget-wrap .line-chart-wrapper {
                    height: 100% !important;
                    display: flex;
                    flex-direction: column;
                }
                .chart-svg-container {
                    flex-grow: 1;
                    min-height: 0;
                }
                .react-resizable-handle {
                    background-image: none !important;
                    width: 14px !important;
                    height: 14px !important;
                    bottom: 5px !important;
                    right: 5px !important;
                }
                .react-resizable-handle::after {
                    content: '';
                    position: absolute;
                    right: 3px;
                    bottom: 3px;
                    width: 7px;
                    height: 7px;
                    border-right: 2px solid #cbd5e1;
                    border-bottom: 2px solid #cbd5e1;
                }
                .react-grid-item.react-grid-placeholder {
                    background: #FF6B35 !important;
                    opacity: 0.08 !important;
                    border-radius: 16px;
                }
            `}</style>
        </div>
    );
}
