import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tag, Trash2 } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function SupplierBrandSettings() {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.SUPPLIER_BRANDS);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(brands.length === 0);
    const [saving, setSaving] = useState(false);
    const [newBrand, setNewBrand] = useState({ name: '', description: '' });

    const [confirmModal, setConfirmModal] = useState({
        show: false, title: '', message: '',
        onConfirm: null, variant: 'default'
    });
    const showConfirm = (title, message, onConfirm, variant = 'default') => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };
    const closeConfirm = () => {
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null, variant: 'default' });
    };

    const fetchBrands = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/supplier/brands');
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            setBrands(Array.isArray(data) ? data : []);
        } catch (err) {
            if (!silent) sileo.error('Failed to load brands');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchBrands(brands.length > 0);
    }, [refreshTrigger]);

    const handleAddBrand = async (e) => {
        e.preventDefault();
        if (!newBrand.name.trim()) {
            sileo.error('Brand name is required');
            return;
        }
        setSaving(true);
        try {
            await api.post('/supplier/brands', {
                name: newBrand.name.trim(),
                description: newBrand.description.trim() || null,
            });
            sileo.success('Brand added successfully');
            markStale(STALE_KEYS.SUPPLIER_BRANDS);
            setNewBrand({ name: '', description: '' });
            fetchBrands(true);
        } catch (err) {
            sileo.error(err.response?.data?.message || 'Failed to add brand');
        } finally {
            setSaving(false);
        }
    };

    const performDeleteBrand = async (id) => {
        closeConfirm();
        try {
            await api.delete(`/supplier/brands/${id}`);
            sileo.success('Brand deleted');
            markStale(STALE_KEYS.SUPPLIER_BRANDS);
            fetchBrands(true);
        } catch (err) {
            sileo.error(err.response?.data?.message || 'Failed to delete brand');
        }
    };

    const handleDeleteBrand = (id, name) => {
        showConfirm(
            'Delete Brand',
            `Are you sure you want to delete "${name}"? This cannot be undone. Products linked to this brand will have their brand cleared.`,
            () => performDeleteBrand(id),
            'destructive'
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Brand Management</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Create and manage brands for your products. Brands will be available when adding products.
                </p>
            </div>

            {/* Add Brand Form */}
            <Card className="p-5 mb-4 border-dashed border-2 bg-secondary/5">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">
                    + Add New Brand
                </h3>
                <form onSubmit={handleAddBrand}>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-3 items-end">
                        <div className="space-y-1.5">
                            <Label>Brand Name <span className="text-destructive">*</span></Label>
                            <Input
                                placeholder="e.g. Stanley, DeWalt, Makita"
                                value={newBrand.name}
                                onChange={e => setNewBrand(b => ({ ...b, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input
                                placeholder="Short description of this brand"
                                value={newBrand.description}
                                onChange={e => setNewBrand(b => ({ ...b, description: e.target.value }))}
                            />
                        </div>
                        <Button type="submit" disabled={saving} className="font-bold h-10">
                            {saving ? 'Adding...' : '+ Add Brand'}
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Brands Table */}
            <Card className="overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading Brands...</span>
                    </div>
                ) : brands.length === 0 ? (
                    <div className="text-center py-12 px-6">
                        <Tag className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                        <h3 className="font-bold text-foreground">No Brands Defined</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Add your first brand above to start assigning brands to your products.
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 w-10">#</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Brand Name</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Description</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {brands.map((brand, i) => (
                                <TableRow key={brand.id} className="hover:bg-secondary/10">
                                    <TableCell className="px-4 py-3 text-muted-foreground text-sm">
                                        {String(i + 1).padStart(2, '0')}
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Tag className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <span className="font-bold text-sm text-foreground">{brand.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                                        {brand.description || <span className="italic text-muted-foreground/50">No description</span>}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteBrand(brand.id, brand.name)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
