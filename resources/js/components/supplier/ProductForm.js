import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, X, Upload, ClipboardList, CheckCircle2, Trash2 } from 'lucide-react';
import { STALE_KEYS, markStale } from '../../store/dataStore';

export default function ProductForm({ editing = null, onClose, onSuccess }) {
    const { showToast } = useToast();
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Core states
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [variantValues, setVariantValues] = useState({ sizes: [], colors: [], weights: [] });

    // Form logic
    const [form, setForm] = useState({ 
        name: '', barcode: '', description: '', category_id: '',
        price: '', min_order_qty: '1', total_stock: '0', is_promoted: false, image: null,
        base_size: '', additional_images: []
    });
    const [variants, setVariants] = useState([]);
    const [variantImages, setVariantImages] = useState({});
    const [variantExtraImages, setVariantExtraImages] = useState({});
    const [variantImagePreviews, setVariantImagePreviews] = useState({});
    const [variantExtraPreviews, setVariantExtraPreviews] = useState({});
    const [imagePreview, setImagePreview] = useState(null);
    const [additionalImagePreviews, setAdditionalImagePreviews] = useState([]);
    const [existingAdditionalImages, setExistingAdditionalImages] = useState([]);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [imageModalTarget, setImageModalTarget] = useState('base');

    useEffect(() => {
        fetchCategories();
        fetchBrands();
        fetchVariantValues();
        if (editing) {
            setupEditMode(editing);
        }
    }, [editing]);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/supplier/categories');
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            setCategories(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
    };

    const fetchBrands = async () => {
        try {
            const res = await api.get('/supplier/brands');
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            setBrands(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
    };

    const fetchVariantValues = async () => {
        try {
            const res = await api.get('/supplier/variant-values');
            const variantData = res.data?.data !== undefined ? res.data.data : (res.data || []);
            const sizes = Array.isArray(variantData) ? variantData.find(v => v.id === 1)?.values || [] : [];
            const colors = Array.isArray(variantData) ? variantData.find(v => v.id === 2)?.values || [] : [];
            const weights = Array.isArray(variantData) ? variantData.find(v => v.id === 3)?.values || [] : [];
            setVariantValues({ sizes, colors, weights });
        } catch (e) { console.error('Failed to load variant values:', e); }
    };

    const setupEditMode = (product) => {
        setForm({
            name: product.name, barcode: product.barcode || '', sku: product.sku || '', description: product.description || '',
            category_id: product.category_id || '', brand_id: product.brand_id ? String(product.brand_id) : '', price: product.price,
            min_order_qty: product.min_order_qty || '1', total_stock: product.total_stock || '0',
            is_promoted: product.is_promoted, image: null,
            base_size: product.base_size || '',
            additional_images: [],
        });
        setExistingAdditionalImages(product.additional_images || []);
        setAdditionalImagePreviews((product.additional_images || []).map(img => `/storage/${img}`));

        const productVariants = (product.variants || []).map(v => ({
            id: v.id,
            size: v.size || '', color: v.color || '', weight: v.weight || '',
            stock: v.stock || 0, price_override: v.price_override || '',
            existing_image_path: v.image_path || null,
            existing_extra_images: v.additional_images || [],
        }));
        setVariants(productVariants);
        
        const previews = {};
        const extraPreviews = {};
        productVariants.forEach((v, idx) => {
            if (v.existing_image_path) previews[idx] = `/storage/${v.existing_image_path}`;
            if (v.existing_extra_images) extraPreviews[idx] = v.existing_extra_images.map(img => `/storage/${img}`);
        });
        setVariantImagePreviews(previews);
        setVariantExtraPreviews(extraPreviews);
        setImagePreview(product.image_path ? `/storage/${product.image_path}` : null);
    };

    const addVariant = () => setVariants(prev => [...prev, { size: '', color: '', weight: '', stock: 0, price_override: '', existing_image_path: null }]);
    const removeVariant = (idx) => setVariants(prev => prev.filter((_, i) => i !== idx));
    const updateVariant = (idx, field, val) => setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v));

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        setForm({ ...form, image: file });
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreview(ev.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleVariantImageChange = (idx, e) => {
        const file = e.target.files[0];
        if (file) {
            setVariantImages(prev => ({ ...prev, [idx]: file }));
            const reader = new FileReader();
            reader.onload = (ev) => setVariantImagePreviews(prev => ({ ...prev, [idx]: ev.target.result }));
            reader.readAsDataURL(file);
        }
    };

    const removeVariantImage = (idx) => {
        setVariantImages(prev => { const upd = { ...prev }; delete upd[idx]; return upd; });
        setVariantImagePreviews(prev => { const upd = { ...prev }; delete upd[idx]; return upd; });
        updateVariant(idx, 'existing_image_path', null);
    };

    const handleAdditionalImagesChange = (e) => {
        const files = Array.from(e.target.files);
        const currentAdditionals = form.additional_images || [];
        const newFiles = [...currentAdditionals, ...files].slice(0, 3);
        setForm(prev => ({ ...prev, additional_images: newFiles }));
        setAdditionalImagePreviews([]);
        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => setAdditionalImagePreviews(prev => [...prev, ev.target.result]);
            reader.readAsDataURL(file);
        });
    };

    const handleVariantExtraImagesChange = (idx, e) => {
        const files = Array.from(e.target.files);
        const currentExtras = variantExtraImages[idx] || [];
        const newFiles = [...currentExtras, ...files].slice(0, 3);
        setVariantExtraImages(prev => ({ ...prev, [idx]: newFiles }));
        setVariantExtraPreviews(prev => ({ ...prev, [idx]: [] }));
        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => setVariantExtraPreviews(prev => {
                const existing = prev[idx] || [];
                return { ...prev, [idx]: [...existing, ev.target.result] };
            });
            reader.readAsDataURL(file);
        });
    };

    const removeAdditionalImage = (imgIdx, isExisting = false) => {
        if (isExisting) {
            setExistingAdditionalImages(prev => prev.filter((_, i) => i !== imgIdx));
        } else {
            setForm(f => ({ ...f, additional_images: f.additional_images.filter((_, i) => i !== imgIdx) }));
            setAdditionalImagePreviews(prev => prev.filter((_, i) => i !== imgIdx));
        }
    };

    const removeVariantExtraImage = (vIdx, imgIdx, isExisting = false) => {
        if (isExisting) {
            setVariants(prev => prev.map((v, i) => i === vIdx ? { 
                ...v, existing_extra_images: v.existing_extra_images.filter((_, j) => j !== imgIdx) 
            } : v));
            setVariantExtraPreviews(prev => {
                const updated = { ...prev };
                if (updated[vIdx]) updated[vIdx] = updated[vIdx].filter((_, j) => j !== imgIdx);
                return updated;
            });
        } else {
            setVariantExtraImages(prev => {
                const updated = { ...prev };
                if (updated[vIdx]) updated[vIdx] = updated[vIdx].filter((_, j) => j !== imgIdx);
                return updated;
            });
            setVariantExtraPreviews(prev => {
                const updated = { ...prev };
                if (updated[vIdx]) updated[vIdx] = updated[vIdx].filter((_, j) => j !== imgIdx);
                return updated;
            });
        }
    };

    const getFilteredVariantValues = (type) => {
        if (!form.category_id) return variantValues[type];
        return variantValues[type].filter(v => !v.category || v.category == form.category_id);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const validVariants = variants.filter(v => v.size?.trim() || v.color?.trim() || v.weight?.trim() || v.stock > 0);
        if (variants.length > 0 && validVariants.length === 0) {
            showToast('Please fill in at least one field for each variant or remove empty variants', 'error');
            return;
        }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('name', form.name);
            fd.append('barcode', form.barcode);
            fd.append('description', form.description);
            if (form.category_id) fd.append('category_id', form.category_id);
            if (form.brand_id) fd.append('brand_id', form.brand_id);
            fd.append('price', form.price);
            fd.append('min_order_qty', form.min_order_qty);
            fd.append('total_stock', Number(form.total_stock) || 0);
            if (form.base_size) fd.append('base_size', form.base_size);
            fd.append('is_promoted', form.is_promoted ? '1' : '0');
            if (form.image) fd.append('image', form.image);
            if (form.additional_images?.length > 0) form.additional_images.forEach(img => fd.append('additional_images[]', img));
            if (editing && existingAdditionalImages.length > 0) fd.append('existing_additional_images', JSON.stringify(existingAdditionalImages));
            if (validVariants.length > 0) {
                fd.append('variants', JSON.stringify(validVariants));
                validVariants.forEach((v, idx) => {
                    if (variantImages[idx]) fd.append(`variant_image_${idx}`, variantImages[idx]);
                    if (variantExtraImages[idx]?.length > 0) variantExtraImages[idx].forEach(img => fd.append(`variant_extra_images_${idx}[]`, img));
                });
            }

            if (editing) {
                fd.append('_method', 'PUT');
                await api.post(`/supplier/products/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                showToast('Product updated!', 'success');
            } else {
                await api.post('/supplier/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                showToast('Product created!', 'success');
            }
            markStale(STALE_KEYS.SUPPLIER_PRODUCTS, STALE_KEYS.ADMIN_INVENTORY, STALE_KEYS.CUSTOMER_SHOP);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            const data = err.response?.data;
            if (data?.errors) {
                const firstError = Object.values(data.errors).flat()[0];
                showToast(firstError || data.message || 'Validation failed', 'error');
            } else {
                showToast(data?.message || 'Failed to save product', 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="animate-in fade-in duration-300">
            {/* Form Header */}
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <Button variant="ghost" size="sm" className="text-primary font-semibold mb-1 -ml-2" onClick={() => !submitting && onClose()}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <h2 className="text-xl font-extrabold text-foreground">{editing ? 'Edit Product' : 'Add New Product'}</h2>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : (editing ? 'Update Product' : 'Create Product')}</Button>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
                    {/* Left: Form Fields */}
                    <div className="space-y-5">
                        <Card className="p-5">
                            <h3 className="font-bold text-foreground mb-4">Product Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-2">
                                    <Label>Product Name *</Label>
                                    <Input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter product name" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Barcode *</Label>
                                    <Input type="text" required value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Enter product barcode" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Category</Label>
                                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Brand</Label>
                                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.brand_id} onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}>
                                        <option value="">No Brand</option>
                                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <Label>Description</Label>
                                    <Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe your product features, materials, etc." />
                                </div>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <h3 className="font-bold text-foreground mb-4">Pricing &amp; Inventory</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Base Price (₱) *</Label>
                                    <Input type="number" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Base Size/Weight</Label>
                                    <Input type="text" value={form.base_size} onChange={e => setForm({ ...form, base_size: e.target.value })} placeholder="e.g. Regular, 500g" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Current Stock *</Label>
                                    <Input type="number" min="0" required value={form.total_stock} onChange={e => setForm({ ...form, total_stock: e.target.value })} placeholder="0" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Min Order Qty</Label>
                                    <Input type="number" min="1" value={form.min_order_qty} onChange={e => setForm({ ...form, min_order_qty: e.target.value })} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                                <Checkbox id="promoted" checked={form.is_promoted} onCheckedChange={v => setForm({ ...form, is_promoted: v })} />
                                <Label htmlFor="promoted" className="cursor-pointer font-semibold text-sm">Promote to Admin</Label>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-foreground">Product Variants</h3>
                                <Button type="button" variant="outline" size="sm" onClick={addVariant}><Plus className="h-3 w-3 mr-1" /> Add Variant</Button>
                            </div>
                                <div className="space-y-3">
                                    {variants.map((v, idx) => (
                                        <Card key={idx} className="p-4 bg-secondary/30 border-2">
                                            <div className="flex items-center gap-4">
                                                <div className="flex-shrink-0">
                                                    {variantImagePreviews[idx] ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setImageModalTarget(idx);
                                                                setImageModalOpen(true);
                                                            }}
                                                            className="w-20 h-20 p-0 rounded-xl border-2 border-dashed border-border overflow-hidden bg-secondary/30 flex flex-col justify-center items-center cursor-pointer hover:border-orange-300 transition-all group relative"
                                                        >
                                                            <img src={variantImagePreviews[idx]} alt={`Variant ${idx}`} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                                <Plus className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                        </button>
                                                    ) : (
                                                        <label className="flex w-20 h-20 rounded-xl border-2 border-dashed border-border overflow-hidden bg-secondary/30 flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-orange-300 transition-all group m-0">
                                                            <Upload className="h-5 w-5 text-muted-foreground opacity-30 group-hover:scale-110 group-hover:text-orange-500 transition-all" />
                                                            <input type="file" accept="image/*" onChange={(e) => handleVariantImageChange(idx, e)} className="hidden" />
                                                        </label>
                                                    )}
                                                </div>
                                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                    <div>
                                                        <Label className="text-[10px] mb-1">Size</Label>
                                                        <Input className="h-8 text-sm" placeholder="e.g. Medium" value={v.size} onChange={e => updateVariant(idx, 'size', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] mb-1">Color</Label>
                                                        <Input className="h-8 text-sm" placeholder="e.g. Red" value={v.color} onChange={e => updateVariant(idx, 'color', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] mb-1">Weight</Label>
                                                        <Input className="h-8 text-sm" placeholder="e.g. 1kg" value={v.weight} onChange={e => updateVariant(idx, 'weight', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] mb-1">Stock</Label>
                                                        <Input className="h-8 text-sm" type="number" placeholder="0" value={v.stock} onChange={e => updateVariant(idx, 'stock', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] mb-1">Price Override (₱)</Label>
                                                        <Input className="h-8 text-sm" type="number" step="0.01" placeholder="Optional" value={v.price_override} onChange={e => updateVariant(idx, 'price_override', e.target.value)} />
                                                    </div>
                                                    <div className="flex items-end">
                                                        <Button variant="destructive" size="sm" className="h-8 w-full" type="button" onClick={() => removeVariant(idx)}>
                                                            <Trash2 className="h-4 w-4 mr-2" /> Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                        </Card>
                    </div>

                    {/* Right: Gallery */}
                    <div className="space-y-5">
                        <Card className="p-5 pb-6">
                            <h3 className="font-bold text-foreground mb-4 text-sm">Product Photo Gallery</h3>
                            <div
                                onClick={() => {
                                    if (imagePreview) {
                                        setImageModalTarget('base');
                                        setImageModalOpen(true);
                                    }
                                }}
                                className="w-full aspect-square rounded-xl bg-secondary border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-secondary/40 hover:border-orange-200 transition-all group relative"
                            >
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} className="w-full h-full object-cover" alt="Main preview" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                            <div className="bg-white/90 text-foreground px-4 py-2 rounded-full text-xs font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                                OPEN GALLERY
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4 group-hover:bg-white transition-colors">
                                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                            <Upload className="h-6 w-6 text-orange-500" />
                                        </div>
                                        <div className="text-sm font-bold text-foreground">Add Product Photo</div>
                                        <div className="text-[10px] mt-1 opacity-50 text-muted-foreground">Main + 3 Gallery Photos</div>
                                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                    </label>
                                )}
                            </div>
                        </Card>
                        {editing && (
                            <Card className="p-5 flex items-center gap-3 bg-green-50 border-green-200">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <div className="text-sm font-bold text-green-700">Status: Active</div>
                            </Card>
                        )}
                    </div>
                </div>
            </form>

            {imageModalOpen && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                    onClick={() => setImageModalOpen(false)}
                >
                    <div
                        className="relative w-full bg-white flex flex-col"
                        style={{ maxWidth: 620, maxHeight: 530, borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.16)', overflow: 'hidden', width: '90vw' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between shrink-0" style={{ padding: '12px 20px 10px', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                                Manage Gallery - {imageModalTarget === 'base' ? 'Main Product' : `Variant #${Number(imageModalTarget) + 1}`}
                            </span>
                            <button
                                type="button"
                                onClick={() => setImageModalOpen(false)}
                                style={{ fontSize: 16, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#111827'}
                                onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                            >
                                <X className="h-[16px] w-[16px]" />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                            <div style={{ padding: '10px 20px 8px' }}>
                                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>Main Showcased Photo</span>
                                    {(imageModalTarget === 'base' ? imagePreview : variantImagePreviews[imageModalTarget]) && (
                                        <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>Active</span>
                                    )}
                                </div>

                                <div className="relative" style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0', background: '#f0f0f0', height: 200, width: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {(imageModalTarget === 'base' ? imagePreview : variantImagePreviews[imageModalTarget]) ? (
                                        <>
                                            <img
                                                src={imageModalTarget === 'base' ? imagePreview : variantImagePreviews[imageModalTarget]}
                                                alt="Main"
                                                style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }}
                                            />
                                            <label style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 12, color: '#555', background: 'white', border: '1px solid #ccc', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
                                                Change Photo
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={e => imageModalTarget === 'base' ? handleImageChange(e) : handleVariantImageChange(imageModalTarget, e)}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => imageModalTarget === 'base' ? (setForm({ ...form, image: null }), setImagePreview(null)) : removeVariantImage(imageModalTarget)}
                                                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                                            >
                                                <X className="h-[11px] w-[11px]" />
                                            </button>
                                        </>
                                    ) : (
                                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer" style={{ height: '100%' }}>
                                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                                <Upload className="h-5 w-5" style={{ color: '#f97316' }} />
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Upload Main Photo</span>
                                            <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Recommended: 800x800px</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={e => imageModalTarget === 'base' ? handleImageChange(e) : handleVariantImageChange(imageModalTarget, e)}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div style={{ padding: '0 20px 8px' }}>
                                <div className="flex items-center justify-between" style={{ marginTop: 12, marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f97316' }}>+ Extra Gallery Photos</span>
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Max: 3</span>
                                </div>

                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[0, 1, 2].map(i => {
                                        let preview = null;
                                        let isExisting = false;

                                        if (imageModalTarget === 'base') {
                                            isExisting = i < (existingAdditionalImages || []).length;
                                            preview = additionalImagePreviews[i];
                                        } else {
                                            const v = variants[imageModalTarget];
                                            isExisting = Boolean(v?.existing_extra_images && v.existing_extra_images[i]);
                                            preview = (variantExtraPreviews[imageModalTarget] || [])[i];
                                        }

                                        return (
                                            <div
                                                key={i}
                                                className="group relative"
                                                style={{ flex: 1, height: 90, border: '1.5px dashed #d0d0d0', borderRadius: 6, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', transition: 'border-color 0.15s, background 0.15s' }}
                                                onMouseEnter={e => { if (!preview) { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.background = '#fff8f5'; } }}
                                                onMouseLeave={e => { if (!preview) { e.currentTarget.style.borderColor = '#d0d0d0'; e.currentTarget.style.background = '#f0f0f0'; } }}
                                            >
                                                {preview ? (
                                                    <>
                                                        <img src={preview} alt={`Gallery ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
                                                        <button
                                                            type="button"
                                                            onClick={() => imageModalTarget === 'base' ? removeAdditionalImage(i, isExisting) : removeVariantExtraImage(imageModalTarget, i, isExisting)}
                                                            style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                                                        >
                                                            <X className="h-[10px] w-[10px]" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                                                        <span style={{ fontSize: 20, color: '#c0c0c0', lineHeight: 1 }}>+</span>
                                                        <span style={{ fontSize: 11, color: '#9e9e9e', marginTop: 3 }}>Add Photo</span>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/*"
                                                            multiple
                                                            onChange={e => imageModalTarget === 'base' ? handleAdditionalImagesChange(e) : handleVariantExtraImagesChange(imageModalTarget, e)}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
