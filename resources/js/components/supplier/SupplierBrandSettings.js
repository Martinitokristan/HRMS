import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tag, Trash2, Pencil, Plus, X } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function SupplierBrandSettings() {
    const { showToast } = useToast();
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.SUPPLIER_BRANDS);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(brands.length === 0);
    const [saving, setSaving] = useState(false);
    const [newBrand, setNewBrand] = useState({ name: '', description: '', category_ids: [] });
    const [editing, setEditing] = useState(null); // { id, name, description, category_ids }
    const [editSaving, setEditSaving] = useState(false);

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

    const fetchAll = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [brandsRes, catsRes] = await Promise.all([
                api.get('/supplier/brands'),
                api.get('/supplier/categories'),
            ]);
            const bData = brandsRes.data?.data !== undefined ? brandsRes.data.data : brandsRes.data;
            const cData = catsRes.data?.data !== undefined ? catsRes.data.data : catsRes.data;
            setBrands(Array.isArray(bData) ? bData : []);
            setCategories(Array.isArray(cData) ? cData : []);
        } catch (err) {
            if (!silent) showToast('Failed to load brands', 'error');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll(brands.length > 0);
    }, [refreshTrigger]);

    const toggleCategoryFor = (which, id) => {
        const target = which === 'new' ? newBrand : editing;
        const setter = which === 'new' ? setNewBrand : setEditing;
        const ids = Array.isArray(target.category_ids) ? target.category_ids : [];
        const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
        setter(s => ({ ...s, category_ids: next }));
    };

    const handleAddBrand = async (e) => {
        e.preventDefault();
        if (!newBrand.name.trim()) {
            showToast('Brand name is required', 'error');
            return;
        }
        setSaving(true);
        try {
            await api.post('/supplier/brands', {
                name: newBrand.name.trim(),
                description: newBrand.description.trim() || null,
                category_ids: newBrand.category_ids,
            });
            showToast('Brand added successfully', 'success');
            markStale(STALE_KEYS.SUPPLIER_BRANDS);
            setNewBrand({ name: '', description: '', category_ids: [] });
            fetchAll(true);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add brand', 'error');
        } finally {
            setSaving(false);
        }
    };

    const performDeleteBrand = async (id) => {
        closeConfirm();
        try {
            await api.delete(`/supplier/brands/${id}`);
            showToast('Brand deleted', 'success');
            markStale(STALE_KEYS.SUPPLIER_BRANDS);
            fetchAll(true);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to delete brand', 'error');
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

    const openEditBrand = (b) => {
        setEditing({
            id: b.id,
            name: b.name || '',
            description: b.description || '',
            category_ids: Array.isArray(b.category_ids)
                ? b.category_ids.map(Number)
                : (Array.isArray(b.categories) ? b.categories.map(c => Number(c.id)) : []),
        });
    };

    const handleSaveEdit = async () => {
        if (!editing?.name.trim()) {
            showToast('Brand name cannot be empty', 'error');
            return;
        }
        setEditSaving(true);
        try {
            await api.put(`/supplier/brands/${editing.id}`, {
                name: editing.name.trim(),
                description: editing.description?.trim() || null,
                category_ids: editing.category_ids,
            });
            showToast('Brand updated', 'success');
            markStale(STALE_KEYS.SUPPLIER_BRANDS);
            setEditing(null);
            fetchAll(true);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update brand', 'error');
        } finally {
            setEditSaving(false);
        }
    };

    const renderCategoryChips = (selectedIds, which) => (
        <div className="flex flex-wrap gap-1.5">
            {categories.map(c => {
                const active = selectedIds.includes(c.id);
                return (
                    <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCategoryFor(which, c.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-secondary'}`}
                    >
                        {c.name}
                    </button>
                );
            })}
            {categories.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No categories defined yet.</span>
            )}
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Brand Management</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Create and manage brands for your products. Tag each brand to one or more categories so the Brand dropdown filters correctly when adding a product.
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
                    <div className="mt-3">
                        <Label className="text-xs">Categories <span className="text-muted-foreground">(tap to toggle — leave empty for "shows in all categories")</span></Label>
                        <div className="mt-1.5">
                            {renderCategoryChips(newBrand.category_ids, 'new')}
                        </div>
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
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Categories</TableHead>
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
                                    <TableCell className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {Array.isArray(brand.categories) && brand.categories.length > 0 ? (
                                                brand.categories.map(c => (
                                                    <Badge key={c.id} variant="outline" className="text-[10px]">{c.name}</Badge>
                                                ))
                                            ) : (
                                                <span className="text-[11px] italic text-muted-foreground">All (no filter)</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                                        {brand.description || <span className="italic text-muted-foreground/50">No description</span>}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                                                onClick={() => openEditBrand(brand)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDeleteBrand(brand.id, brand.name)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            {editing && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !editSaving && setEditing(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Edit Brand</h2>
                                <p className="text-sm text-muted-foreground">Update name, description, or which categories this brand appears under.</p>
                            </div>
                            <button onClick={() => !editSaving && setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label>Brand Name *</Label>
                                <Input value={editing.name} onChange={(e) => setEditing(s => ({ ...s, name: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Description</Label>
                                <Input value={editing.description} onChange={(e) => setEditing(s => ({ ...s, description: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Categories</Label>
                                {renderCategoryChips(editing.category_ids, 'edit')}
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <Button variant="outline" className="flex-1" onClick={() => setEditing(null)} disabled={editSaving}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSaveEdit} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
