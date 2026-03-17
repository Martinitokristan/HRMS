import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Settings2, Plus, Pencil, Trash2 } from 'lucide-react';

const TABS = [
    { id: 'general', label: 'General', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'categories', label: 'Categories', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
    { id: 'sizes', label: 'Sizes', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'colors', label: 'Colors', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
    { id: 'weights', label: 'Grams & Weights', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
    { id: 'master_variants', label: 'Variant Types', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
    { id: 'units', label: 'Unit Conversions', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', count: 3 },
    { id: 'security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002-2zm10-10V7a4 4 0 00-8 0v4h8z' }
];

export default function Settings() {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('general');
    const [settings, setSettings] = useState({});
    const [variants, setVariants] = useState([]);
    const [conversions, setConversions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    const [newVal, setNewVal] = useState({ variant_id: '', label: '', hex_code: '', description: '', category: '' });
    const [newConv, setNewConv] = useState({ category_id: '', purchase_unit: '', sell_unit: '', conversion_factor: 1 });
    const [newVariant, setNewVariant] = useState({ id: null, name: '', description: '', status: 'active' });
    const [newUnitType, setNewUnitType] = useState({ id: null, purchase_unit: '', sell_unit: '', multiplier: 1 });
    const [newCat, setNewCat] = useState({ id: null, name: '', description: '' });
    const [modal, setModal] = useState({ open: false, type: '', title: '', data: null });

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const res = await axios.get('/settings');
                if (!isMounted) return;
                const { settings, variants, unitTypes, categories } = res.data.data;
                setSettings(settings || {});
                setVariants(variants || []);
                setCategories(categories || []);
                setConversions(unitTypes || []);
            } catch (err) {
                if (isMounted) showToast('Failed to load settings', 'error');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [refreshTrigger]);

    const handleChange = (key, value) => {
        setSettings({
            ...settings,
            [activeTab]: {
                ...(settings[activeTab] || {}),
                [key]: value
            }
        });
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await axios.put('/settings', {
                group: activeTab,
                settings: settings[activeTab] || {}
            });
            showToast('Settings saved');
            triggerRefresh();
        } catch (e) {
            showToast('Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveVal = async (variantId) => {
        try {
            await axios.post('/settings/variant-values', { ...newVal, variant_id: variantId });
            showToast('Value added');
            setNewVal({ variant_id: '', label: '', hex_code: '', description: '', category: '' });
            triggerRefresh();
        } catch (e) {
            showToast('Error saving value', 'error');
        }
    };

    const handleDeleteVal = async (id) => {
        if (!confirm('Are you sure?')) return;
        try {
            await axios.delete(`/settings/variant-values/${id}`);
            triggerRefresh();
        } catch (e) {
            showToast('Error deleting value', 'error');
        }
    };

    const handleSaveType = async () => {
        try {
            await axios.post('/settings/variant-types', newVariant);
            showToast('Variant type saved');
            setModal({ open: false });
            triggerRefresh();
        } catch (e) {
            showToast('Error saving variant type', 'error');
        }
    };

    const handleSaveConv = async () => {
        try {
            await axios.post('/settings/unit-conversions', newConv);
            showToast('Rule added');
            setNewConv({ category_id: '', purchase_unit: '', sell_unit: '', conversion_factor: 1 });
            triggerRefresh();
        } catch (e) {
            showToast('Error saving rule', 'error');
        }
    };

    const handleSaveUnit = async () => {
        try {
            await axios.post('/settings/unit-types', newUnitType);
            showToast('Unit type saved');
            setModal({ open: false });
            triggerRefresh();
        } catch (e) {
            showToast('Error saving unit type', 'error');
        }
    };

    const handleDeleteUnit = async (id) => {
        if (!confirm('Are you sure?')) return;
        try {
            await axios.delete(`/settings/unit-types/${id}`);
            triggerRefresh();
        } catch (e) {
            showToast('Error deleting unit type', 'error');
        }
    };

    const handleSaveCat = async () => {
        try {
            await axios.post('/settings/categories', newCat);
            showToast('Category saved');
            setModal({ open: false });
            triggerRefresh();
        } catch (e) {
            showToast('Error saving category', 'error');
        }
    };

    const handleDeleteCat = async (id) => {
        if (!confirm('Are you sure you want to delete this category? This might affect products linked to it.')) return;
        try {
            await axios.delete(`/settings/categories/${id}`);
            showToast('Category deleted');
            triggerRefresh();
        } catch (e) {
            showToast('Error deleting category', 'error');
        }
    };

    if (loading) return <div className="flex items-center justify-center py-20"><div className="spinner" /></div>;

    const renderIcon = (d) => (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d={d} />
        </svg>
    );

    return (
        <div className="flex gap-6">
            <Card className="w-[240px] shrink-0 p-2 h-fit sticky top-4">
                <div className="space-y-0.5">
                    {TABS.slice(0, 5).map(tab => (
                        <button
                            key={tab.id}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {renderIcon(tab.icon)}
                            {tab.label}
                        </button>
                    ))}
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-1">System</div>
                    {TABS.slice(5).map(tab => (
                        <button
                            key={tab.id}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {renderIcon(tab.icon)}
                            {tab.label}
                            {tab.count && <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">{tab.count}</Badge>}
                        </button>
                    ))}
                </div>
            </Card>

            <div className="flex-1 min-w-0">

                {/* ── GENERAL ── */}
                {activeTab === 'general' && (
                    <>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">General Settings</h2>
                            <p className="text-sm text-muted-foreground">Store information, branding, and business details</p>
                        </div>
                        <Card className="p-5 mb-6 flex items-center gap-5">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white text-2xl font-bold shrink-0">{settings.general?.store_name?.charAt(0) || 'H'}</div>
                            <div>
                                <h4 className="font-semibold text-foreground">Store Logo</h4>
                                <p className="text-sm text-muted-foreground mb-2">PNG or JPG, max 2MB. Recommended size: 256×256px</p>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm">Upload Logo</Button>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Remove</Button>
                                </div>
                            </div>
                        </Card>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Business Information</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <Label>Store Name</Label>
                                <Input type="text" value={settings.general?.store_name || ''} onChange={e => handleChange('store_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Number</Label>
                                <Input type="text" value={settings.general?.contact_number || ''} onChange={e => handleChange('contact_number', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Business Email</Label>
                                <Input type="email" value={settings.general?.contact_email || ''} onChange={e => handleChange('contact_email', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tax Rate (%)</Label>
                                <Input type="number" value={settings.general?.tax_rate || '12'} onChange={e => handleChange('tax_rate', e.target.value)} />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Complete Store Address</Label>
                                <Textarea rows={3} value={settings.general?.store_address || ''} onChange={e => handleChange('store_address', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4 border-t border-border">
                            <Button onClick={handleSaveSettings} disabled={saving}>Save Changes</Button>
                        </div>
                    </>
                )}

                {/* ── CATEGORIES ── */}
                {activeTab === 'categories' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Category Management</h2>
                                <p className="text-sm text-muted-foreground">Organize your products into logical groups</p>
                            </div>
                            <Button onClick={() => { setNewCat({ id: null, name: '', description: '' }); setModal({ open: true, type: 'category', title: 'Add New Category' }); }} className="gap-2">
                                <Plus className="h-4 w-4" /> Add Category
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {categories.map(cat => (
                                <Card key={cat.id} className="p-4">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">{renderIcon('M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z')}</div>
                                        <div>
                                            <h4 className="font-semibold text-foreground">{cat.name}</h4>
                                            <p className="text-sm text-muted-foreground">{cat.description || 'No description provided.'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-3 border-t border-border">
                                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => { setNewCat(cat); setModal({ open: true, type: 'category', title: 'Edit Category' }); }}>
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1" onClick={() => handleDeleteCat(cat.id)}>
                                            <Trash2 className="h-3.5 w-3.5" /> Delete
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── SIZES ── */}
                {activeTab === 'sizes' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">Size Management</h2>
                            <p className="text-sm text-muted-foreground">Define sizes used across products (e.g. screw lengths, pipe diameters)</p>
                        </div>
                        <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
                            <h5 className="text-sm font-bold text-primary mb-3">+ Add New Size</h5>
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_100px] gap-3 items-end">
                                <div className="space-y-1.5"><Label>Size Label</Label><Input placeholder="e.g. 3 inch, Small, XL" value={newVal.label} onChange={e => setNewVal({...newVal, label: e.target.value})} /></div>
                                <div className="space-y-1.5"><Label>Category / Group</Label><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={newVal.category} onChange={e => setNewVal({...newVal, category: e.target.value})}><option value="">No Category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                <div className="space-y-1.5"><Label>Description</Label><Input placeholder="Optional note" value={newVal.description} onChange={e => setNewVal({...newVal, description: e.target.value})} /></div>
                                <Button onClick={() => handleSaveVal(1)}>Add</Button>
                            </div>
                        </Card>
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader><TableRow className="bg-secondary/50 hover:bg-secondary/50"><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">#</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Size Label</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Category</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Description</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {variants.find(v => v.id === 1)?.values.map((v, i) => (
                                        <TableRow key={v.id}>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{String(i + 1).padStart(2, '0')}</TableCell>
                                            <TableCell className="px-4 py-3 font-bold text-foreground">{v.label}</TableCell>
                                            <TableCell className="px-4 py-3"><Badge variant="outline">{categories.find(c => c.id == v.category)?.name || v.category || '—'}</Badge></TableCell>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{v.description}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => setNewVal(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteVal(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>
                )}

                {/* ── COLORS ── */}
                {activeTab === 'colors' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">Color Management</h2>
                            <p className="text-sm text-muted-foreground">Manage paint colors, product color variants, and swatches</p>
                        </div>
                        <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
                            <h5 className="text-sm font-bold text-primary mb-3">+ Add New Color</h5>
                            <div className="grid grid-cols-1 md:grid-cols-[60px_1fr_1fr_1fr_100px] gap-3 items-end">
                                <div className="space-y-1.5"><Label>Swatch</Label><div className="h-9 w-full rounded-md border border-border" style={{ background: newVal.hex_code || '#fff' }} /></div>
                                <div className="space-y-1.5"><Label>Color Name</Label><Input placeholder="e.g. Ivory White" value={newVal.label} onChange={e => setNewVal({...newVal, label: e.target.value})} /></div>
                                <div className="space-y-1.5"><Label>Hex Code</Label><Input placeholder="#FFFFFF" value={newVal.hex_code} onChange={e => setNewVal({...newVal, hex_code: e.target.value})} /></div>
                                <div className="space-y-1.5"><Label>Category</Label><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={newVal.category} onChange={e => setNewVal({...newVal, category: e.target.value})}><option value="">No Category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                <Button onClick={() => handleSaveVal(2)}>Add</Button>
                            </div>
                        </Card>
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader><TableRow className="bg-secondary/50 hover:bg-secondary/50"><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Swatch</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Color Name</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Hex Code</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Category</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {variants.find(v => v.id === 2)?.values.map(v => (
                                        <TableRow key={v.id}>
                                            <TableCell className="px-4 py-3"><div className="h-6 w-6 rounded-full border border-border" style={{ background: v.hex_code }} /></TableCell>
                                            <TableCell className="px-4 py-3 font-bold text-foreground">{v.label}</TableCell>
                                            <TableCell className="px-4 py-3 text-muted-foreground font-mono text-[12px]">{v.hex_code}</TableCell>
                                            <TableCell className="px-4 py-3"><Badge variant="outline">{categories.find(c => c.id == v.category)?.name || v.category || '—'}</Badge></TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary"><Pencil className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteVal(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>
                )}

                {/* ── WEIGHTS ── */}
                {activeTab === 'weights' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">Grams & Weights Management</h2>
                            <p className="text-sm text-muted-foreground">Manage standard weights for products (e.g., 500g, 1Kg, 250ml)</p>
                        </div>
                        <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
                            <h5 className="text-sm font-bold text-primary mb-3">+ Add New Weight</h5>
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_100px] gap-3 items-end">
                                <div className="space-y-1.5"><Label>Weight Label</Label><Input placeholder="e.g. 500g, 1Kg, 250ml" value={newVal.label} onChange={e => setNewVal({...newVal, label: e.target.value})} /></div>
                                <div className="space-y-1.5"><Label>Category / Group</Label><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={newVal.category} onChange={e => setNewVal({...newVal, category: e.target.value})}><option value="">No Category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                <div className="space-y-1.5"><Label>Description</Label><Input placeholder="Optional note" value={newVal.description} onChange={e => setNewVal({...newVal, description: e.target.value})} /></div>
                                <Button onClick={() => handleSaveVal(3)}>Add</Button>
                            </div>
                        </Card>
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader><TableRow className="bg-secondary/50 hover:bg-secondary/50"><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">#</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Weight Label</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Category</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Description</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {variants.find(v => v.id === 3)?.values.map((v, i) => (
                                        <TableRow key={v.id}>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{String(i + 1).padStart(2, '0')}</TableCell>
                                            <TableCell className="px-4 py-3 font-bold text-foreground">{v.label}</TableCell>
                                            <TableCell className="px-4 py-3"><Badge variant="outline">{categories.find(c => c.id == v.category)?.name || v.category || '—'}</Badge></TableCell>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{v.description}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => setNewVal(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteVal(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>
                )}

                {/* ── VARIANT TYPES ── ✅ FIXED: was 'variants', now 'master_variants' */}
                {activeTab === 'master_variants' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Variant Types</h2>
                                <p className="text-sm text-muted-foreground">Define product variant types used for grouping (e.g. Size, Color, Material)</p>
                            </div>
                            <Button onClick={() => { setNewVariant({ id: null, name: '', description: '', status: 'active' }); setModal({ open: true, type: 'variant', title: 'Add Variant Type' }); }} className="gap-2">
                                <Plus className="h-4 w-4" /> Add Variant Type
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {variants.map(v => (
                                <Card key={v.id} className="p-4">
                                    <div className="flex items-start gap-3 mb-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">{renderIcon(TABS.find(t => t.label === v.name || t.id === v.name.toLowerCase())?.icon || 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10')}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-foreground">{v.name}</h4>
                                                <Badge variant={v.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{v.status.charAt(0).toUpperCase() + v.status.slice(1)}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{v.description}</p>
                                        </div>
                                    </div>
                                    <p className="text-[12px] text-muted-foreground mt-2 mb-4">
                                        Values: {v.values.slice(0, 5).map(val => val.label).join(', ')}{v.values.length > 5 ? '...' : ''}
                                    </p>
                                    <div className="flex gap-2 pt-3 border-t border-border">
                                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => { setNewVariant(v); setModal({ open: true, type: 'variant', title: 'Edit Variant Type' }); }}>
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                                            if (v.name === 'Size') setActiveTab('sizes');
                                            else if (v.name === 'Color') setActiveTab('colors');
                                            else setModal({ open: true, type: 'manage_values', title: `Manage ${v.name} Values`, data: v });
                                        }}>Manage Values</Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── UNITS ── */}
                {activeTab === 'units' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Weight & Unit Management</h2>
                                <p className="text-sm text-muted-foreground">Define how products are measured (e.g. Kg, Box of 12, Pcs)</p>
                            </div>
                            <Button onClick={() => { setNewUnitType({ id: null, purchase_unit: '', sell_unit: '', multiplier: 1 }); setModal({ open: true, type: 'unit', title: 'Add Weight/Unit Type' }); }} className="gap-2">
                                <Plus className="h-4 w-4" /> Add Unit Type
                            </Button>
                        </div>
                        <Card className="overflow-hidden mb-6">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">#</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Purchase Unit</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Selling Unit</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Multiplier (Pcs per Unit)</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(conversions || []).map((u, i) => (
                                        <TableRow key={u.id}>
                                            <TableCell className="px-4 py-3 text-muted-foreground">{String(i + 1).padStart(2, '0')}</TableCell>
                                            <TableCell className="px-4 py-3 font-bold text-foreground">{u.purchase_unit}</TableCell>
                                            <TableCell className="px-4 py-3 font-bold text-foreground">{u.sell_unit}</TableCell>
                                            <TableCell className="px-4 py-3 font-bold text-primary">× {u.multiplier}</TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => { setNewUnitType(u); setModal({ open: true, type: 'unit', title: 'Edit Weight/Unit Type' }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteUnit(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                        <h5 className="text-sm font-bold text-foreground mb-3">Weight Classes (Visual Guide)</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[{icon: '🍂', title: 'Light', desc: 'Under 5 kg'}, {icon: '📦', title: 'Medium', desc: '5 - 25 kg'}, {icon: '�️', title: 'Heavy', desc: '25 - 100 kg'}, {icon: '🚚', title: 'Bulk', desc: 'Over 100 kg'}].map(w => (
                                <Card key={w.title} className="p-4 text-center">
                                    <div className="text-2xl mb-2">{w.icon}</div>
                                    <h5 className="font-semibold text-foreground text-sm">{w.title}</h5>
                                    <p className="text-[12px] text-muted-foreground">{w.desc}</p>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── NOTIFICATIONS ── */}
                {activeTab === 'notifications' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">Notification Settings</h2>
                            <p className="text-sm text-muted-foreground">Control how and when the system sends alerts to admins, customers, and riders</p>
                        </div>
                        <div className="space-y-1 mb-6">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Inventory Alerts</div>
                            {[
                                { k: 'low_stock_alerts', t: 'Low Stock Reorder Alerts', d: 'Notify admin when product stock falls below reorder threshold' },
                                { k: 'out_of_stock_alerts', t: 'Out of Stock Alerts', d: 'Immediate alert when any product reaches zero stock' },
                                { k: 'auto_po_alerts', t: 'Auto Purchase Order Created', d: 'Notify admin when an automated PO is generated' }
                            ].map(item => (
                                <Card key={item.k} className="p-4 flex items-center justify-between gap-4">
                                    <div><h5 className="text-sm font-semibold text-foreground">{item.t}</h5><p className="text-[12px] text-muted-foreground">{item.d}</p></div>
                                    <Switch checked={settings.notifications?.[item.k] === '1'} onCheckedChange={checked => handleChange(item.k, checked ? '1' : '0')} />
                                </Card>
                            ))}
                            <div className="text-[10px] font-bold uppercase tracking-wider text-primary mt-5 mb-3">Delivery Alerts</div>
                            {[
                                { k: 'delivery_updates', t: 'Delivery Status Updates (Customer)', d: 'SMS/App notification when delivery status changes' },
                                { k: 'delivery_failed', t: 'Failed Delivery Alert (Admin)', d: 'Notify admin when a delivery attempt fails' },
                                { k: 'rider_assignment', t: 'New Order Assignment (Rider)', d: 'Push notification to rider when assigned a new delivery' }
                            ].map(item => (
                                <Card key={item.k} className="p-4 flex items-center justify-between gap-4">
                                    <div><h5 className="text-sm font-semibold text-foreground">{item.t}</h5><p className="text-[12px] text-muted-foreground">{item.d}</p></div>
                                    <Switch checked={settings.notifications?.[item.k] === '1'} onCheckedChange={checked => handleChange(item.k, checked ? '1' : '0')} />
                                </Card>
                            ))}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Notification Channels</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-foreground">📧 Email</h5>
                                    <Switch checked={settings.notifications?.email_enabled === '1'} onCheckedChange={checked => handleChange('email_enabled', checked ? '1' : '0')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12px]">Admin Email</Label>
                                    <Input type="email" placeholder="admin@hrms.com" value={settings.notifications?.admin_email || ''} onChange={e => handleChange('admin_email', e.target.value)} />
                                </div>
                            </Card>
                            <Card className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-foreground">📱 SMS</h5>
                                    <Switch checked={settings.notifications?.sms_enabled === '1'} onCheckedChange={checked => handleChange('sms_enabled', checked ? '1' : '0')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[12px]">Admin Mobile</Label>
                                    <Input type="text" placeholder="+63 917 123 4567" value={settings.notifications?.admin_mobile || ''} onChange={e => handleChange('admin_mobile', e.target.value)} />
                                </div>
                            </Card>
                        </div>
                        <div className="flex justify-end pt-4 border-t border-border mt-6">
                            <Button onClick={handleSaveSettings} disabled={saving}>Save Preferences</Button>
                        </div>
                    </div>
                )}

                {/* ── SECURITY ── */}
                {activeTab === 'security' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-foreground">Security Configuration</h2>
                            <p className="text-sm text-muted-foreground">Manage system security, authentication, and access control</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <Label>Session Timeout (minutes)</Label>
                                <Input type="number" value={settings.security?.session_timeout || '120'} onChange={e => handleChange('session_timeout', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Login Attempts</Label>
                                <Input type="number" value={settings.security?.max_login_attempts || '5'} onChange={e => handleChange('max_login_attempts', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1 mb-6">
                            {[
                                { k: 'suspicious_login', t: 'Flag Suspicious Logins', d: 'Notify admin when login from new device occur' },
                                { k: 'two_factor', t: 'Enforce Two-Factor Authentication', d: 'Require 2FA for all administrative accounts' },
                                { k: 'auto_logout', t: 'Auto Logout on Inactivity', d: 'Automatically sign out users after timeout period' }
                            ].map(item => (
                                <Card key={item.k} className="p-4 flex items-center justify-between gap-4">
                                    <div><h5 className="text-sm font-semibold text-foreground">{item.t}</h5><p className="text-[12px] text-muted-foreground">{item.d}</p></div>
                                    <Switch checked={settings.security?.[item.k] === '1'} onCheckedChange={checked => handleChange(item.k, checked ? '1' : '0')} />
                                </Card>
                            ))}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-border">
                            <Button onClick={handleSaveSettings} disabled={saving}>Update Security Policy</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── MODAL ── */}
            {modal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModal({ open: false })}>
                    <Card className="w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-border">
                            <h3 className="text-base font-bold text-foreground">{modal.title}</h3>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setModal({ open: false })}>&times;</Button>
                        </div>
                        <div className="p-5 space-y-4">
                            {modal.type === 'variant' && (
                                <>
                                    <div className="space-y-2"><Label>Variant Type Name*</Label><Input placeholder="e.g. Material, Brand" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></div>
                                    <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional note" value={newVariant.description} onChange={e => setNewVariant({...newVariant, description: e.target.value})} /></div>
                                    <div className="space-y-2">
                                        <Label>Status</Label>
                                        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={newVariant.status} onChange={e => setNewVariant({...newVariant, status: e.target.value})}>
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </>
                            )}
                            {modal.type === 'value' && (
                                <>
                                    <div className="space-y-2"><Label>Label / Name*</Label><Input placeholder="e.g. 3 inch, Wood, XL" value={newVal.label} onChange={e => setNewVal({...newVal, label: e.target.value})} /></div>
                                    {modal.title.toLowerCase().includes('color') && (
                                        <div className="space-y-2"><Label>Hex Color</Label><input type="color" className="h-10 w-full rounded-md border border-input" value={newVal.hex_code || '#000000'} onChange={e => setNewVal({...newVal, hex_code: e.target.value})} /></div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>Category / Group</Label>
                                        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={newVal.category} onChange={e => setNewVal({...newVal, category: e.target.value})}>
                                            <option value="">No Category</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Optional details..." value={newVal.description} onChange={e => setNewVal({...newVal, description: e.target.value})} /></div>
                                </>
                            )}
                            {modal.type === 'unit' && (
                                <>
                                    <div className="space-y-2"><Label>Bulk/Purchase Unit*</Label><Input placeholder="e.g. Box, Roll, Pack" value={newUnitType.purchase_unit} onChange={e => setNewUnitType({...newUnitType, purchase_unit: e.target.value})} /></div>
                                    <div className="space-y-2"><Label>Smallest/Selling Unit*</Label><Input placeholder="e.g. Piece, Meter, Set" value={newUnitType.sell_unit} onChange={e => setNewUnitType({...newUnitType, sell_unit: e.target.value})} /></div>
                                    <div className="space-y-2"><Label>Multiplier (Pcs per Bulk Unit)*</Label><Input type="number" min="0.01" step="0.01" value={newUnitType.multiplier} onChange={e => setNewUnitType({...newUnitType, multiplier: e.target.value})} /></div>
                                    <p className="text-xs text-muted-foreground">Example: 1 <b>{newUnitType.purchase_unit || 'Box'}</b> = {newUnitType.multiplier} <b>{newUnitType.sell_unit || 'Pieces'}</b></p>
                                </>
                            )}
                            {modal.type === 'category' && (
                                <>
                                    <div className="space-y-2"><Label>Category Name*</Label><Input placeholder="e.g. Paint, Plumbing, Tools" value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} /></div>
                                    <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Optional details..." value={newCat.description} onChange={e => setNewCat({...newCat, description: e.target.value})} /></div>
                                </>
                            )}
                            {modal.type === 'manage_values' && (
                                <div>
                                    <Card className="bg-secondary/50 p-3 mb-4">
                                        <h5 className="text-sm font-semibold text-foreground mb-2">Add New Value to {modal.data?.name}</h5>
                                        <div className="flex gap-2">
                                            <Input className="flex-1" placeholder="Value label..." value={newVal.label} onChange={e => setNewVal({...newVal, label: e.target.value})} />
                                            <Button onClick={() => handleSaveVal(modal.data?.id)}>Add</Button>
                                        </div>
                                    </Card>
                                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                                        {modal.data?.values.map(v => (
                                            <div key={v.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50">
                                                <div>
                                                    <div className="font-semibold text-sm text-foreground">{v.label}</div>
                                                    <div className="text-[11px] text-muted-foreground">Category: {categories.find(c => c.id == v.category)?.name || '—'}</div>
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteVal(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {modal.type !== 'manage_values' && (
                            <div className="flex justify-end gap-2 p-5 border-t border-border">
                                <Button variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
                                <Button onClick={
                                    modal.type === 'variant' ? handleSaveType :
                                    modal.type === 'unit' ? handleSaveUnit :
                                    modal.type === 'category' ? handleSaveCat :
                                    handleSaveVal
                                }>Save changes</Button>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}