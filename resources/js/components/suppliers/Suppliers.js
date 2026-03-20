import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import StatCard from '../shared/StatCard';
import Modal from '../shared/Modal';
import ConfirmModal from '../shared/ConfirmModal';
import SupplierForm from './SupplierForm';
import SupplierViewModal from './SupplierViewModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Building2, Eye, Trash2, Plus, Package, ShoppingCart, Handshake, CheckCircle, Star } from 'lucide-react';

const SupplierStatusBadge = ({ status }) => {
    const config = {
        active: { className: 'border-success/30 bg-success-light text-success-foreground', label: 'Active' },
        inactive: { className: 'border-border bg-secondary text-muted-foreground', label: 'Inactive' },
        preferred: { className: 'border-info/30 bg-info/10 text-info', label: 'Preferred' },
        blacklisted: { className: 'border-destructive/30 bg-destructive/5 text-destructive', label: 'Blacklisted' }
    };
    const c = config[status] || config.inactive;
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
};

export default function Suppliers() {
    const { showToast } = useToast();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [viewSupplierId, setViewSupplierId] = useState(null);

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/suppliers', { params: { search, page, status: statusFilter !== 'all' ? statusFilter : undefined } });
            setSuppliers(res.data.data?.data || res.data.data || []);
            setTotal(res.data.data?.total || res.data.data?.length || 0);
        } catch (error) {
            showToast('Error fetching suppliers', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (isMounted) fetchSuppliers();
        }, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [search, page, statusFilter, refreshTrigger]);

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await axios.delete(`/suppliers/${deleteId}`);
            if (res.data.status === 'success') {
                showToast('Supplier deleted successfully');
                triggerRefresh();
            } else {
                showToast(res.data.message || 'Error deleting supplier', 'error');
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Error deleting supplier';
            showToast(msg, 'error');
        } finally {
            setDeleteId(null);
        }
    };

    const handleEdit = (supplier) => {
        setSelectedSupplier(supplier);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setSelectedSupplier(null);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedSupplier(null);
    };

    const handleSaveSuccess = () => {
        triggerRefresh();
        setIsModalOpen(false);
        setSelectedSupplier(null);
    };

    // Stats calculation
    const stats = useMemo(() => ({
        total: total,
        active: suppliers.filter(s => (s.status || 'active') === 'active').length,
        preferred: suppliers.filter(s => s.status === 'preferred').length,
        withProducts: suppliers.filter(s => (s.products_count || 0) > 0).length
    }), [suppliers, total]);

    return (
        <div>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" /> Supplier Management
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage your vendor partnerships and track supplier performance</p>
                </div>
                <Button onClick={handleAdd} className="gap-2">
                    <Plus className="h-4 w-4" /> Add New Supplier
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Suppliers" value={stats.total} icon={Handshake} accentColor="accent" />
                <StatCard label="Active Partners" value={stats.active} icon={CheckCircle} accentColor="green" />
                <StatCard label="Preferred Suppliers" value={stats.preferred} icon={Star} accentColor="blue" />
                <StatCard label="With Products" value={stats.withProducts} icon={Package} accentColor="purple" />
            </div>

            {/* Filters & Controls */}
            <div className="mb-4 space-y-3">
                <FilterBar 
                    search={search} 
                    onSearchChange={(v) => { setSearch(v); setPage(1); }}
                    placeholder="Search suppliers by name, contact, email..."
                />
                <div className="flex items-center gap-2 flex-wrap">
                    {[
                        { key: 'all', label: 'All', count: stats.total },
                        { key: 'active', label: 'Active', count: stats.active },
                        { key: 'preferred', label: 'Preferred', count: stats.preferred },
                        { key: 'inactive', label: 'Inactive', count: stats.total - stats.active - stats.preferred }
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

            {/* Results Count */}
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm text-muted-foreground">Showing {suppliers.length} of {total} suppliers</span>
                {loading && <span className="text-sm text-primary">Loading...</span>}
            </div>

            {/* Suppliers Table */}
            <Card className="overflow-hidden mb-4">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Supplier</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Contact Person</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Contact Info</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Performance</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Status</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10"><div className="spinner mx-auto" /></TableCell></TableRow>
                        ) : suppliers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16">
                                    <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30 text-muted-foreground" />
                                    <h3 className="text-base font-semibold text-foreground mb-1">No suppliers found</h3>
                                    <p className="text-sm text-muted-foreground mb-4">{search || statusFilter !== 'all' ? 'Try adjusting your filters or search terms' : 'Add your first supplier to get started with vendor management'}</p>
                                    <Button onClick={handleAdd} className="gap-2">
                                        <Plus className="h-4 w-4" /> Add Your First Supplier
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ) : suppliers.map(supplier => {
                            const initials = supplier.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                            return (
                                <TableRow key={supplier.id}>
                                    <TableCell className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">{initials}</div>
                                            <div>
                                                <div className="font-semibold text-foreground">{supplier.name}</div>
                                                <div className="text-[12px] text-muted-foreground">ID: #{supplier.id}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="font-semibold text-foreground">{supplier.contact_name || '-'}</div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="text-sm text-foreground">{supplier.email || '-'}</div>
                                        <div className="text-sm text-muted-foreground">{supplier.phone || '-'}</div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="text-sm text-foreground flex items-center gap-1">
                                            <Package className="h-3.5 w-3.5 text-muted-foreground" /> <span className="font-semibold">{supplier.products_count || 0}</span> Products
                                        </div>
                                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                                            <ShoppingCart className="h-3.5 w-3.5" /> <span className="font-semibold">{supplier.purchase_orders_count || 0}</span> Orders
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <SupplierStatusBadge status={supplier.status || 'active'} />
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => setViewSupplierId(supplier.id)} className="h-7 px-2 gap-1">
                                                <Eye className="h-3.5 w-3.5" /> View
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => setDeleteId(supplier.id)} className="h-7 px-2">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>

            {/* Pagination */}
            {!loading && suppliers.length > 0 && (
                <Pagination page={page} total={total} perPage={15} onChange={setPage} />
            )}

            {/* Modals */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                title={selectedSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                size="md"
            >
                <SupplierForm
                    supplier={selectedSupplier}
                    onSuccess={handleSaveSuccess}
                    onCancel={handleModalClose}
                />
            </Modal>

            <ConfirmModal
                isOpen={!!deleteId}
                onCancel={() => setDeleteId(null)}
                onConfirm={handleDelete}
                message="Are you sure you want to delete this supplier? This action cannot be undone."
            />

            <SupplierViewModal 
                isOpen={!!viewSupplierId} 
                onClose={() => setViewSupplierId(null)} 
                supplierId={viewSupplierId} 
                onEdit={(supplier) => { setViewSupplierId(null); handleEdit(supplier); }}
            />
        </div>
    );
}
