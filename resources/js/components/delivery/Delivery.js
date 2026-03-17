import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import StatCard from '../shared/StatCard';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import ConfirmModal from '../shared/ConfirmModal';
import DeliveryViewModal from './DeliveryViewModal';
import { StatusBadge } from '../shared/Badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Truck, Eye, Rocket, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

const STATUS_CONFIG = {
    pending: { label: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7', icon: '⏳' },
    in_progress: { label: 'In Progress', color: '#3B82F6', bgColor: '#EFF6FF', icon: '🚚' },
    delivered: { label: 'Delivered', color: '#22C55E', bgColor: '#F0FDF4', icon: '✅' },
    failed: { label: 'Failed', color: '#EF4444', bgColor: '#FEF2F2', icon: '❌' }
};

export default function Delivery() {
    const { showToast } = useToast();
    const [deliveries, setDeliveries] = useState([]);
    const [riders, setRiders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    
    // Pagination & Modal states
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, delivered: 0, failed: 0, today_delivered: 0 });
    
    const [viewDeliveryId, setViewDeliveryId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    
    const [selectedDeliveries, setSelectedDeliveries] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showBulkAssign, setShowBulkAssign] = useState(false);
    const [bulkRiderId, setBulkRiderId] = useState('');
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    // Fetch data
    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(async () => {
            setLoading(true);
            try {
                const [deliveriesRes, ridersRes] = await Promise.all([
                    axios.get('/deliveries', { 
                        params: { search, page, status: statusFilter !== 'all' ? statusFilter : undefined } 
                    }),
                    axios.get('/riders/available')
                ]);

                if (!isMounted) return;

                const data = deliveriesRes.data;
                const dData = data.data?.data || data.data || [];
                setDeliveries(dData);
                setTotal(data.data?.total || dData.length);
                if (data.stats) {
                    setStats(data.stats);
                }
                setRiders(ridersRes.data.data || []);
            } catch (err) {
                if (isMounted) showToast('Failed to fetch delivery data', 'error');
            } finally {
                if (isMounted) setLoading(false);
            }
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(debounce);
        };
    }, [search, statusFilter, page, refreshTrigger]);

    // Actions
    const handleAssign = async (deliveryId, riderId) => {
        if (!riderId) return;
        try {
            await axios.put(`/deliveries/${deliveryId}/assign`, { rider_id: riderId });
            showToast('✅ Rider assigned successfully');
            triggerRefresh();
        } catch (err) {
            showToast('❌ Assignment failed', 'error');
        }
    };

    const handleStatus = async (deliveryId, status) => {
        try {
            await axios.put(`/deliveries/${deliveryId}/status`, { status });
            const statusLabel = STATUS_CONFIG[status]?.label || status;
            showToast(`✅ Delivery marked as ${statusLabel}`);
            triggerRefresh();
        } catch (err) {
            showToast('❌ Status update failed', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await axios.delete(`/deliveries/${deleteId}`);
            showToast('✅ Delivery deleted successfully');
            triggerRefresh();
        } catch (err) {
            showToast(err.response?.data?.message || '❌ Delete failed', 'error');
        } finally {
            setDeleteId(null);
        }
    };

    const handleBulkAssign = async () => {
        if (!bulkRiderId || selectedDeliveries.length === 0) return;
        
        try {
            await Promise.all(
                selectedDeliveries.map(id => 
                    axios.put(`/deliveries/${id}/assign`, { rider_id: bulkRiderId })
                )
            );
            showToast(`✅ Assigned ${selectedDeliveries.length} deliveries to rider`);
            setSelectedDeliveries([]);
            setShowBulkAssign(false);
            setBulkRiderId('');
            triggerRefresh();
        } catch (err) {
            showToast('❌ Bulk assignment failed', 'error');
        }
    };

    const toggleSelection = (id) => {
        setSelectedDeliveries(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAllSelection = () => {
        if (selectedDeliveries.length > 0 && selectedDeliveries.length === deliveries.filter(d => d.status === 'pending').length) {
            setSelectedDeliveries([]);
        } else {
            setSelectedDeliveries(deliveries.filter(d => d.status === 'pending').map(d => d.id));
        }
    };

    const formatTime = (date) => new Date(date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

    return (
        <div>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Truck className="h-6 w-6 text-primary" /> Delivery Management
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Track, assign and manage all deliveries in real-time</p>
                </div>
                <Button variant="outline" size="sm" onClick={triggerRefresh} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <StatCard label="Total Deliveries" value={stats.total} icon="📦" accentColor="accent" />
                <StatCard label="Pending" value={stats.pending} icon="⏳" accentColor="amber" />
                <StatCard label="In Progress" value={stats.in_progress} icon="🚚" accentColor="blue" />
                <StatCard label="Delivered Today" value={stats.today_delivered} icon="✅" accentColor="green" />
                <StatCard label="Failed" value={stats.failed} icon="❌" accentColor="red" />
            </div>

            {/* Bulk Actions Bar */}
            {selectedDeliveries.length > 0 && (
                <Card className="p-3 mb-4 flex items-center justify-between flex-wrap gap-3 bg-primary/5 border-primary/20">
                    <span className="text-sm font-semibold text-foreground">{selectedDeliveries.length} delivery(s) selected</span>
                    <div className="flex items-center gap-2">
                        {!showBulkAssign ? (
                            <Button size="sm" onClick={() => setShowBulkAssign(true)}>Assign Rider</Button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <select className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={bulkRiderId} onChange={(e) => setBulkRiderId(e.target.value)}>
                                    <option value="">Select Rider...</option>
                                    {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <Button size="sm" onClick={handleBulkAssign} disabled={!bulkRiderId}>Assign</Button>
                                <Button variant="ghost" size="sm" onClick={() => { setShowBulkAssign(false); setBulkRiderId(''); }}>Cancel</Button>
                            </div>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDeliveries([])}>Clear</Button>
                    </div>
                </Card>
            )}

            {/* Filters */}
            <div className="mb-4 space-y-3">
                <FilterBar
                    search={search}
                    onSearchChange={(v) => { setSearch(v); setPage(1); }}
                    placeholder="Search by tracking #, order #, customer, or address..."
                />
                <div className="flex items-center gap-2 flex-wrap">
                    {[
                        { key: 'all', label: 'All', count: stats.total },
                        { key: 'pending', label: 'Pending', count: stats.pending },
                        { key: 'in_progress', label: 'In Progress', count: stats.in_progress },
                        { key: 'delivered', label: 'Delivered', count: stats.delivered },
                        { key: 'failed', label: 'Failed', count: stats.failed }
                    ].map(({ key, label, count }) => (
                        <Button
                            key={key}
                            variant={statusFilter === key ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setStatusFilter(key); setPage(1); }}
                            className="gap-1.5"
                        >
                            {label}
                            <Badge variant={statusFilter === key ? 'secondary' : 'outline'} className="ml-1 text-[10px] px-1.5 py-0">{count}</Badge>
                        </Button>
                    ))}
                </div>
            </div>

            {/* Results Header */}
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm text-muted-foreground">Showing {deliveries.length} of {total} deliveries</span>
                {riders.length > 0 && <span className="text-sm text-muted-foreground">🚴 {riders.length} riders available</span>}
            </div>

            {/* Deliveries Table */}
            <Card className="overflow-hidden mb-4">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="w-[40px] px-4">
                                <Checkbox
                                    onCheckedChange={toggleAllSelection}
                                    checked={deliveries.length > 0 && selectedDeliveries.length === deliveries.filter(d => d.status === 'pending').length && deliveries.filter(d => d.status === 'pending').length > 0}
                                    disabled={deliveries.filter(d => d.status === 'pending').length === 0}
                                />
                            </TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Tracking / Order</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Customer & Address</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Rider</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Status</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10"><div className="spinner mx-auto" /></TableCell></TableRow>
                        ) : deliveries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16">
                                    <div className="text-4xl mb-2 opacity-50">📭</div>
                                    <h3 className="text-base font-semibold text-foreground mb-1">No deliveries found</h3>
                                    <p className="text-sm text-muted-foreground">Try adjusting your filters or search criteria</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            deliveries.map(d => {
                                const isSelected = selectedDeliveries.includes(d.id);
                                const canSelect = d.status === 'pending';
                                return (
                                    <TableRow key={d.id} className={isSelected ? 'bg-primary/5' : ''}>
                                        <TableCell className="px-4">
                                            {canSelect && (
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleSelection(d.id)}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="font-semibold text-foreground">{d.tracking_number}</div>
                                            <div className="text-[12px] text-muted-foreground">Order #{d.sale?.order_number}</div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="font-semibold text-foreground">{d.sale?.customer?.name || 'Walk-in Customer'}</div>
                                            <div className="text-[12px] text-muted-foreground truncate max-w-[250px]" title={d.address}>{d.address}</div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            {d.rider ? (
                                                <div className="font-semibold text-sm text-foreground">{d.rider.name}</div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">Unassigned</span>
                                            )}
                                            {d.status !== 'delivered' && d.status !== 'failed' && (
                                                <select
                                                    value={d.rider_id || ''}
                                                    onChange={(e) => handleAssign(d.id, e.target.value)}
                                                    className="mt-1 flex h-7 w-[130px] rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                >
                                                    <option value="">{d.rider ? 'Change Rider...' : 'Assign Rider...'}</option>
                                                    {riders.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name} ({r.active_deliveries_count || 0} active)</option>
                                                    ))}
                                                </select>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <StatusBadge status={d.status} />
                                            <div className="text-[11px] text-muted-foreground mt-1">{formatTime(d.updated_at)}</div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => setViewDeliveryId(d.id)} className="h-7 px-2 gap-1">
                                                    <Eye className="h-3.5 w-3.5" /> View
                                                </Button>
                                                {d.status === 'pending' && d.rider_id && (
                                                    <Button size="sm" onClick={() => handleStatus(d.id, 'in_progress')} className="h-7 px-2 gap-1">
                                                        <Rocket className="h-3.5 w-3.5" /> Start
                                                    </Button>
                                                )}
                                                {d.status === 'in_progress' && (
                                                    <>
                                                        <Button size="sm" onClick={() => handleStatus(d.id, 'delivered')} className="h-7 px-2 gap-1 bg-success hover:bg-success/90">
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Delivered
                                                        </Button>
                                                        <Button variant="destructive" size="sm" onClick={() => { if(confirm('Mark as failed?')) handleStatus(d.id, 'failed'); }} className="h-7 px-2 gap-1">
                                                            <XCircle className="h-3.5 w-3.5" /> Failed
                                                        </Button>
                                                    </>
                                                )}
                                                {d.status === 'pending' && (
                                                    <Button variant="destructive" size="sm" onClick={() => setDeleteId(d.id)} className="h-7 px-2">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Pagination */}
            {!loading && deliveries.length > 0 && (
                <Pagination page={page} total={total} perPage={15} onChange={setPage} />
            )}

            {/* Modals */}
            <DeliveryViewModal isOpen={!!viewDeliveryId} onClose={() => setViewDeliveryId(null)} deliveryId={viewDeliveryId} />
            
            <ConfirmModal
                isOpen={!!deleteId}
                onCancel={() => setDeleteId(null)}
                onConfirm={handleDelete}
                message="Are you sure you want to delete this delivery? Only pending deliveries can be deleted."
            />
        </div>
    );
}