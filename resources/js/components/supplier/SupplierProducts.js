import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import Modal from '../shared/Modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, X, Upload } from 'lucide-react';

export default function SupplierProducts() {
    const { showToast } = useToast();
    const [products, setProducts] = useState({ data: [], total: 0 });
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        name: '', sku: '', description: '', category_id: '',
        price: '', min_order_qty: '1', is_promoted: false, image: null,
    });
    const [variants, setVariants] = useState([]);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const location = useLocation();
    
    useEffect(() => { fetchProducts(); }, [page, search, categoryFilter]);
    useEffect(() => { fetchCategories(); }, []);

    // Sync URL search params with local state
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const catId = params.get('category_id');
        const shouldOpen = params.get('open_form') === 'true';

        if (catId) {
            setCategoryFilter(catId);
            setPage(1);
            if (shouldOpen) {
                // Pre-fill form with this category
                setEditing(null);
                setForm(f => ({ ...f, name: '', category_id: catId, sku: '', description: '', price: '', min_order_qty: '1', is_promoted: false, image: null }));
                setVariants([]);
                setImagePreview(null);
                setFormOpen(true);
            }
        } else if (location.pathname === '/supplier/products' && !location.search) {
             setCategoryFilter('');
        }
    }, [location.search]);

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/supplier/categories');
            setCategories(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = { page, per_page: 15 };
            if (search) params.search = search;
            if (categoryFilter) params.category_id = categoryFilter;
            const res = await axios.get('/supplier/products', { params });
            setProducts(res.data.data);
        } catch (e) {
            showToast('Failed to load products', 'error');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditing(null);
        setForm({ name: '', sku: '', description: '', category_id: '', price: '', min_order_qty: '1', is_promoted: false, image: null });
        setVariants([]);
        setImagePreview(null);
        setFormOpen(true);
    };

    const openEdit = (product) => {
        setEditing(product);
        setForm({
            name: product.name, sku: product.sku || '', description: product.description || '',
            category_id: product.category_id || '', price: product.price,
            min_order_qty: product.min_order_qty || '1', is_promoted: product.is_promoted, image: null,
        });
        setVariants((product.variants || []).map(v => ({
            size: v.size || '', color: v.color || '', weight: v.weight || '',
            stock: v.stock || 0, price_override: v.price_override || '', sku_suffix: v.sku_suffix || '',
        })));
        setImagePreview(product.image_path ? `/storage/${product.image_path}` : null);
        setFormOpen(true);
    };

    const addVariant = () => {
        setVariants(prev => [...prev, { size: '', color: '', weight: '', stock: 0, price_override: '', sku_suffix: '' }]);
    };

    const removeVariant = (idx) => {
        setVariants(prev => prev.filter((_, i) => i !== idx));
    };

    const updateVariant = (idx, field, val) => {
        setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        setForm({ ...form, image: file });
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('name', form.name);
            fd.append('sku', form.sku);
            fd.append('description', form.description);
            if (form.category_id) fd.append('category_id', form.category_id);
            fd.append('price', form.price);
            fd.append('min_order_qty', form.min_order_qty);
            fd.append('is_promoted', form.is_promoted ? '1' : '0');
            if (form.image) fd.append('image', form.image);
            if (variants.length > 0) fd.append('variants', JSON.stringify(variants));

            if (editing) {
                fd.append('_method', 'PUT');
                await axios.post(`/supplier/products/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                showToast('Product updated!', 'success');
            } else {
                await axios.post('/supplier/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                showToast('Product created!', 'success');
            }
            setFormOpen(false);
            fetchProducts();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to save product', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await axios.delete(`/supplier/products/${deleteConfirm.id}`);
            showToast('Product deleted', 'success');
            setDeleteConfirm(null);
            fetchProducts();
        } catch (err) {
            showToast('Failed to delete product', 'error');
        }
    };

    // FULLSCREEN PRODUCT FORM
    if (formOpen) {
        return (
            <div>
                {/* Form Header */}
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <div>
                        <Button variant="ghost" size="sm" className="text-primary font-semibold mb-1 -ml-2" onClick={() => !submitting && setFormOpen(false)}>
                            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Products
                        </Button>
                        <h2 className="text-xl font-extrabold text-foreground">{editing ? 'Edit Product' : 'Add New Product'}</h2>
                    </div>
                    <div className="flex gap-3">
                        {editing && <Button variant="destructive" size="sm" onClick={() => { setFormOpen(false); setDeleteConfirm(editing); }}>Delete</Button>}
                        <Button variant="outline" size="sm" onClick={() => setFormOpen(false)} disabled={submitting}>Cancel</Button>
                        <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : (editing ? 'Update Product' : 'Create Product')}</Button>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
                        {/* Left: Form Fields */}
                        <div className="space-y-5">
                            {/* Basic Info */}
                            <Card className="p-5">
                                <h3 className="font-bold text-foreground mb-4">Product Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 col-span-2">
                                        <Label>Product Name *</Label>
                                        <Input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter product name" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>SKU</Label>
                                        <Input type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Auto-generated if empty" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Category</Label>
                                        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <Label>Description</Label>
                                        <Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe your product features, materials, etc." />
                                    </div>
                                </div>
                            </Card>

                            {/* Pricing */}
                            <Card className="p-5">
                                <h3 className="font-bold text-foreground mb-4">Pricing & Quantity</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Base Price (₱) *</Label>
                                        <Input type="number" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Min Order Qty</Label>
                                        <Input type="number" min="1" value={form.min_order_qty} onChange={e => setForm({ ...form, min_order_qty: e.target.value })} />
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <div className="flex items-center gap-2">
                                            <Checkbox id="promoted" checked={form.is_promoted} onCheckedChange={v => setForm({ ...form, is_promoted: v })} />
                                            <Label htmlFor="promoted" className="cursor-pointer font-semibold text-sm">Promote to Admin</Label>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Variants */}
                            <Card className="p-5">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-foreground">Product Variants</h3>
                                    <Button variant="outline" size="sm" onClick={addVariant}><Plus className="h-3 w-3 mr-1" /> Add Variant</Button>
                                </div>

                                {variants.length === 0 ? (
                                    <div className="py-8 text-center bg-secondary/50 rounded-xl border border-dashed border-border">
                                        <div className="text-2xl mb-2">📋</div>
                                        <p className="text-sm text-muted-foreground">No variants added yet. Add variants for size, color, or weight options.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-[1fr_1fr_1fr_80px_100px_36px] gap-2 px-3">
                                            {['Size', 'Color', 'Weight', 'Stock', 'Price', ''].map((h, i) => (
                                                <span key={i} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</span>
                                            ))}
                                        </div>
                                        {variants.map((v, idx) => (
                                            <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_80px_100px_36px] gap-2 items-center p-3 bg-secondary/50 rounded-lg border border-border">
                                                <Input className="h-8 text-sm" placeholder="e.g. 1inch" value={v.size} onChange={e => updateVariant(idx, 'size', e.target.value)} />
                                                <Input className="h-8 text-sm" placeholder="e.g. Red" value={v.color} onChange={e => updateVariant(idx, 'color', e.target.value)} />
                                                <Input className="h-8 text-sm" placeholder="e.g. 500g" value={v.weight} onChange={e => updateVariant(idx, 'weight', e.target.value)} />
                                                <Input className="h-8 text-sm" type="number" placeholder="0" value={v.stock} onChange={e => updateVariant(idx, 'stock', e.target.value)} />
                                                <Input className="h-8 text-sm" type="number" step="0.01" placeholder="₱" value={v.price_override} onChange={e => updateVariant(idx, 'price_override', e.target.value)} />
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeVariant(idx)}><X className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>

                        {/* Right: Image & Preview */}
                        <div className="space-y-5">
                            <Card className="p-5">
                                <h3 className="font-bold text-foreground mb-3">Product Image</h3>
                                <div className="w-full aspect-square rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden mb-3">
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center text-muted-foreground">
                                            <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                            <div className="text-sm">Upload product image</div>
                                        </div>
                                    )}
                                </div>
                                <label className="w-full">
                                    <Button variant="outline" className="w-full cursor-pointer" asChild><span><Upload className="h-4 w-4 mr-1" /> Choose Image</span></Button>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                </label>
                            </Card>

                            {editing && (
                                <Card className="p-5">
                                    <h3 className="font-bold text-foreground mb-3">Status</h3>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                                        <span className="text-xl">✅</span>
                                        <div>
                                            <div className="font-semibold text-sm text-green-700">Active</div>
                                            <div className="text-xs text-green-500">Product is visible</div>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        );
    }

    // PRODUCT LIST VIEW
    return (
        <div>
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-foreground">Product Catalog</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage and organize your products</p>
                </div>
            </div>

            <FilterBar
                search={search}
                onSearchChange={v => { setSearch(v); setPage(1); }}
                filters={[{
                    value: categoryFilter,
                    onChange: v => { setCategoryFilter(v); setPage(1); },
                    options: [
                        { value: '', label: 'All Categories' },
                        ...categories.map(c => ({ value: c.id, label: c.name }))
                    ]
                }]}
            />

            {loading ? (
                <div className="flex justify-center py-12"><div className="spinner" /></div>
            ) : products.data?.length === 0 ? (
                <Card className="text-center py-16 px-8">
                    <div className="text-5xl mb-4">📦</div>
                    <h3 className="text-lg font-bold text-foreground mb-2">No Products Yet</h3>
                    <p className="text-muted-foreground mb-6">Start adding products to promote to admin buyers.</p>
                    <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Your First Product</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {products.data.map(p => (
                        <Card key={p.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(p)}>
                            <div className="h-40 bg-secondary flex items-center justify-center relative">
                                {p.image_path ? (
                                    <img src={`/storage/${p.image_path}`} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl opacity-20">📦</span>
                                )}
                                {p.is_promoted && (
                                    <Badge className="absolute top-2 right-2 bg-primary text-white text-[10px]">PROMOTED</Badge>
                                )}
                            </div>
                            <div className="p-4">
                                <div className="font-bold text-foreground text-sm mb-0.5">{p.name}</div>
                                <div className="text-xs text-muted-foreground mb-2">{p.category?.name || 'Uncategorized'} • {p.variants?.length || 0} variants</div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-primary">₱{Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    <Badge variant="outline" className={p.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>{p.status || 'active'}</Badge>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Pagination page={page} total={products.total} perPage={15} onChange={setPage} />

            {/* Delete Confirm */}
            <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Product?" size="sm" hideFooter>
                <p className="mb-6 text-muted-foreground">
                    Are you sure you want to delete <strong className="text-foreground">{deleteConfirm?.name}</strong>? This cannot be undone.
                </p>
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
                </div>
            </Modal>
        </div>
    );
}
