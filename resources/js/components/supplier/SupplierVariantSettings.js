import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Ruler, Palette, Weight as WeightIcon } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

const TABS = [
    { id: 'sizes', label: 'Sizes', Icon: Ruler, variantId: 1 },
    { id: 'colors', label: 'Colors', Icon: Palette, variantId: 2 },
    { id: 'weights', label: 'Grams & Weights', Icon: WeightIcon, variantId: 3 },
];

export default function SupplierVariantSettings({ initialTab = 'sizes' }) {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.SUPPLIER_SETTINGS);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [variants, setVariants] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(variants.length === 0);
    const [saving, setSaving] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        show: false, title: '', message: '',
        onConfirm: null, variant: 'default'
    });
    const showConfirm = (title, message, onConfirm, variant = 'default') => {
        setConfirmModal({ show: true, title, message, onConfirm, variant });
    };
    const closeConfirm = () => {
        setConfirmModal({
            show: false, title: '', message: '',
            onConfirm: null, variant: 'default'
        });
    };

    const [newVal, setNewVal] = useState({ variant_id: '', label: '', hex_code: '', description: '', category: '' });

    // Update active tab when initialTab prop changes
    React.useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [variantsRes, categoriesRes] = await Promise.all([
                api.get('/supplier/variant-values'),
                api.get('/supplier/categories')
            ]);
            setVariants(variantsRes.data.data !== undefined ? variantsRes.data.data : variantsRes.data || []);
            setCategories(categoriesRes.data.data !== undefined ? categoriesRes.data.data : categoriesRes.data || []);
        } catch (err) {
            // Silence background error
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(variants.length > 0);
    }, [refreshTrigger]);

    const handleSaveVal = async (variantId) => {
        if (!newVal.label.trim()) {
            sileo.error('Please enter a label');
            return;
        }
        setSaving(true);
        try {
            await api.post('/supplier/variant-values', { ...newVal, variant_id: variantId });
            sileo.success('Value added successfully');
            markStale(STALE_KEYS.SUPPLIER_SETTINGS);
            setNewVal({ variant_id: '', label: '', hex_code: '', description: '', category: '' });
            fetchData(true);
        } catch (e) {
            sileo.error(e.response?.data?.message || 'Error saving value');
        } finally {
            setSaving(false);
        }
    };

    const performDeleteVal = async (id) => {
        closeConfirm();
        try {
            await api.delete(`/supplier/variant-values/${id}`);
            sileo.success('Value deleted');
            markStale(STALE_KEYS.SUPPLIER_SETTINGS);
            fetchData(true);
        } catch (e) {
            sileo.error('Error deleting value');
        }
    };

    const handleDeleteVal = (id) => {
        showConfirm(
            'Delete Variant Value',
            'Delete this value? Products using it may be affected.',
            () => performDeleteVal(id),
            'destructive'
        );
    };

    if (loading) {
        return <div className="flex justify-center py-12"><div className="spinner" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-border">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                            activeTab === tab.id 
                                ? 'border-primary text-primary' 
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.Icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* SIZES */}
            {activeTab === 'sizes' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-foreground">Size Management</h2>
                        <p className="text-sm text-muted-foreground">Define sizes for your products (e.g. screw lengths, pipe diameters, clothing sizes)</p>
                    </div>
                    <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
                        <h5 className="text-sm font-bold text-primary mb-3">+ Add New Size</h5>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_100px] gap-3 items-end">
                            <div className="space-y-1.5">
                                <Label>Size Label *</Label>
                                <Input placeholder="e.g. 3 inch, Small, XL" value={newVal.label} onChange={e => setNewVal({...newVal, label: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Category / Group</Label>
                                <select 
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                                    value={newVal.category} 
                                    onChange={e => setNewVal({...newVal, category: e.target.value})}
                                >
                                    <option value="">No Category</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Description</Label>
                                <Input placeholder="Optional note" value={newVal.description} onChange={e => setNewVal({...newVal, description: e.target.value})} />
                            </div>
                            <Button onClick={() => handleSaveVal(1)} disabled={saving}>
                                {saving ? 'Adding...' : 'Add'}
                            </Button>
                        </div>
                    </Card>
                    <Card className="overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">#</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Size Label</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Category</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Description</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variants.find(v => v.id === 1)?.values?.length > 0 ? (
                                    variants.find(v => v.id === 1).values.map((v, i) => (
                                        <TableRow key={v.id}>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{String(i + 1).padStart(2, '0')}</TableCell>
                                            <TableCell className="px-4 py-3 font-bold text-foreground">{v.label}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <Badge variant="outline">{categories.find(c => c.id == v.category)?.name || v.category || '—'}</Badge>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{v.description || '—'}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteVal(v.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No sizes defined yet. Add your first size above.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            {/* COLORS */}
            {activeTab === 'colors' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-foreground">Color Management</h2>
                        <p className="text-sm text-muted-foreground">Manage paint colors, product color variants, and swatches</p>
                    </div>
                    <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
                        <h5 className="text-sm font-bold text-primary mb-3">+ Add New Color</h5>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_1fr_1fr_100px] gap-3 items-end">
                            <div className="space-y-1.5">
                                <Label>Color Name *</Label>
                                <Input placeholder="e.g. Sky Blue, Red, Matte Black" value={newVal.label} onChange={e => setNewVal({...newVal, label: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Hex Code</Label>
                                <div className="flex gap-2">
                                    <Input type="color" className="h-9 w-12 p-1 cursor-pointer" value={newVal.hex_code || '#000000'} onChange={e => setNewVal({...newVal, hex_code: e.target.value})} />
                                    <Input type="text" className="flex-1" placeholder="#000000" value={newVal.hex_code} onChange={e => setNewVal({...newVal, hex_code: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Category / Group</Label>
                                <select 
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                                    value={newVal.category} 
                                    onChange={e => setNewVal({...newVal, category: e.target.value})}
                                >
                                    <option value="">No Category</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Description</Label>
                                <Input placeholder="Optional note" value={newVal.description} onChange={e => setNewVal({...newVal, description: e.target.value})} />
                            </div>
                            <Button onClick={() => handleSaveVal(2)} disabled={saving}>
                                {saving ? 'Adding...' : 'Add'}
                            </Button>
                        </div>
                    </Card>
                    <Card className="overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">#</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Color</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Hex Code</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Category</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Description</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variants.find(v => v.id === 2)?.values?.length > 0 ? (
                                    variants.find(v => v.id === 2).values.map((v, i) => (
                                        <TableRow key={v.id}>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{String(i + 1).padStart(2, '0')}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded border border-border shrink-0" style={{ backgroundColor: v.hex_code || '#ccc' }} />
                                                    <span className="font-bold text-foreground">{v.label}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.hex_code || '—'}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <Badge variant="outline">{categories.find(c => c.id == v.category)?.name || v.category || '—'}</Badge>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{v.description || '—'}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteVal(v.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No colors defined yet. Add your first color above.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            {/* WEIGHTS */}
            {activeTab === 'weights' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-foreground">Weight Management</h2>
                        <p className="text-sm text-muted-foreground">Define weight options for products (e.g. 500g, 1kg, 5lbs)</p>
                    </div>
                    <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
                        <h5 className="text-sm font-bold text-primary mb-3">+ Add New Weight</h5>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_100px] gap-3 items-end">
                            <div className="space-y-1.5">
                                <Label>Weight Label *</Label>
                                <Input placeholder="e.g. 500g, 1kg, 5lbs" value={newVal.label} onChange={e => setNewVal({...newVal, label: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Category / Group</Label>
                                <select 
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                                    value={newVal.category} 
                                    onChange={e => setNewVal({...newVal, category: e.target.value})}
                                >
                                    <option value="">No Category</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Description</Label>
                                <Input placeholder="Optional note" value={newVal.description} onChange={e => setNewVal({...newVal, description: e.target.value})} />
                            </div>
                            <Button onClick={() => handleSaveVal(3)} disabled={saving}>
                                {saving ? 'Adding...' : 'Add'}
                            </Button>
                        </div>
                    </Card>
                    <Card className="overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">#</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Weight Label</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Category</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Description</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variants.find(v => v.id === 3)?.values?.length > 0 ? (
                                    variants.find(v => v.id === 3).values.map((v, i) => (
                                        <TableRow key={v.id}>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{String(i + 1).padStart(2, '0')}</TableCell>
                                            <TableCell className="px-4 py-3 font-bold text-foreground">{v.label}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <Badge variant="outline">{categories.find(c => c.id == v.category)?.name || v.category || '—'}</Badge>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{v.description || '—'}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteVal(v.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No weights defined yet. Add your first weight above.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
