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
import { ArrowLeft, Plus, X, Upload, ClipboardList, Package, CheckCircle2 } from 'lucide-react';

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
        name: '', barcode: '', description: '', category_id: '',
        price: '', min_order_qty: '1', total_stock: '0', is_promoted: false, image: null,
        base_size: '', additional_images: []
    });
    const [variants, setVariants] = useState([]);
    const [variantImages, setVariantImages] = useState({});
    const [variantExtraImages, setVariantExtraImages] = useState({});
    const [variantImagePreviews, setVariantImagePreviews] = useState({});
    const [variantExtraPreviews, setVariantExtraPreviews] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [additionalImagePreviews, setAdditionalImagePreviews] = useState([]);
    const [existingAdditionalImages, setExistingAdditionalImages] = useState([]);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [imageModalTarget, setImageModalTarget] = useState('base'); // 'base' or variant index

    // Variant values from settings (sizes, colors, weights)
    const [variantValues, setVariantValues] = useState({ sizes: [], colors: [], weights: [] });

    const location = useLocation();
    
    useEffect(() => { fetchProducts(); }, [page, search, categoryFilter]);
    useEffect(() => { fetchCategories(); fetchVariantValues(); }, []);

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
                setForm(f => ({ ...f, name: '', category_id: catId, barcode: '', description: '', price: '', min_order_qty: '1', is_promoted: false, image: null }));
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

    const fetchVariantValues = async () => {
        try {
            const res = await axios.get('/supplier/variant-values');
            const variantData = res.data.data || [];
            
            // Organize by variant type: 1=Size, 2=Color, 3=Weight
            const sizes = variantData.find(v => v.id === 1)?.values || [];
            const colors = variantData.find(v => v.id === 2)?.values || [];
            const weights = variantData.find(v => v.id === 3)?.values || [];
            
            setVariantValues({ sizes, colors, weights });
        } catch (e) { 
            console.error('Failed to load variant values:', e); 
        }
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
        setForm({ name: '', barcode: '', description: '', category_id: '', price: '', min_order_qty: '1', total_stock: '0', is_promoted: false, image: null, base_size: '', additional_images: [] });
        setVariants([]);
        setVariantImages({});
        setVariantExtraImages({});
        setVariantImagePreviews({});
        setVariantExtraPreviews({});
        setImagePreview(null);
        setAdditionalImagePreviews([]);
        setExistingAdditionalImages([]);
        setFormOpen(true);
    };

    const openEdit = (product) => {
        setEditing(product);
        setForm({
            name: product.name, barcode: product.barcode || '', sku: product.sku || '', description: product.description || '',
            category_id: product.category_id || '', price: product.price,
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
            if (v.existing_image_path) {
                previews[idx] = `/storage/${v.existing_image_path}`;
            }
            if (v.existing_extra_images) {
                extraPreviews[idx] = v.existing_extra_images.map(img => `/storage/${img}`);
            }
        });
        setVariantImagePreviews(previews);
        setVariantExtraPreviews(extraPreviews);
        setVariantImages({});
        setVariantExtraImages({});
        setImagePreview(product.image_path ? `/storage/${product.image_path}` : null);
        setFormOpen(true);
    };

    const addVariant = () => {
        setVariants(prev => [...prev, { size: '', color: '', weight: '', stock: 0, price_override: '', existing_image_path: null }]);
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

    const handleVariantImageChange = (idx, e) => {
        const file = e.target.files[0];
        if (file) {
            setVariantImages(prev => ({ ...prev, [idx]: file }));
            const reader = new FileReader();
            reader.onload = (ev) => {
                setVariantImagePreviews(prev => ({ ...prev, [idx]: ev.target.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const removeVariantImage = (idx) => {
        setVariantImages(prev => {
            const updated = { ...prev };
            delete updated[idx];
            return updated;
        });
        setVariantImagePreviews(prev => {
            const updated = { ...prev };
            delete updated[idx];
            return updated;
        });
        updateVariant(idx, 'existing_image_path', null);
    };

    const handleAdditionalImagesChange = (e) => {
        const files = Array.from(e.target.files);
        // Limit to 3 additional (4 total)
        const currentAdditionals = form.additional_images || [];
        const newFiles = [...currentAdditionals, ...files].slice(0, 3);
        setForm(prev => ({ ...prev, additional_images: newFiles }));
        
        // Clear old additionals previews (only for non-existing files)
        setAdditionalImagePreviews([]);
        
        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setAdditionalImagePreviews(prev => [...prev, ev.target.result]);
            };
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
            reader.onload = (ev) => {
                setVariantExtraPreviews(prev => {
                    const existing = prev[idx] || [];
                    return { ...prev, [idx]: [...existing, ev.target.result] };
                });
            };
            reader.readAsDataURL(file);
        });
    };

    const removeAdditionalImage = (imgIdx, isExisting = false) => {
        if (isExisting) {
            const updatedExisting = existingAdditionalImages.filter((_, i) => i !== imgIdx);
            setExistingAdditionalImages(updatedExisting);
            // Previews for existing are just URLs
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

    // Filter variant values by selected category
    const getFilteredVariantValues = (type) => {
        if (!form.category_id) return variantValues[type];
        
        // Filter by category - only show values that match the selected category or have no category
        return variantValues[type].filter(v => 
            !v.category || v.category == form.category_id
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate variants - filter out completely empty ones
        const validVariants = variants.filter(v => 
            v.size?.trim() || v.color?.trim() || v.weight?.trim() || v.stock > 0
        );
        
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
            fd.append('price', form.price);
            fd.append('min_order_qty', form.min_order_qty);
            // total_stock = base product's own stock (always independent from variant stocks)
            fd.append('total_stock', Number(form.total_stock) || 0);
            if (form.base_size) fd.append('base_size', form.base_size);
            fd.append('is_promoted', form.is_promoted ? '1' : '0');
            if (form.image) fd.append('image', form.image);
            
            // Additional base images
            if (form.additional_images?.length > 0) {
                form.additional_images.forEach(img => fd.append('additional_images[]', img));
            }
            if (editing && existingAdditionalImages.length > 0) {
                fd.append('existing_additional_images', JSON.stringify(existingAdditionalImages));
            }
            
            if (validVariants.length > 0) {
                fd.append('variants', JSON.stringify(validVariants));
                // Append variant images and extras
                validVariants.forEach((v, idx) => {
                    if (variantImages[idx]) {
                        fd.append(`variant_image_${idx}`, variantImages[idx]);
                    }
                    if (variantExtraImages[idx]?.length > 0) {
                        variantExtraImages[idx].forEach(img => fd.append(`variant_extra_images_${idx}[]`, img));
                    }
                });
            }

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
                                    <div className="space-y-1.5 col-span-2">
                                        <Label>Description</Label>
                                        <Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe your product features, materials, etc." />
                                    </div>
                                </div>
                            </Card>

                            {/* Pricing */}
                            <Card className="p-5">
                                <h3 className="font-bold text-foreground mb-4">Pricing &amp; Inventory</h3>
                                {(() => {
                                    // Auto-detect base variant type by what's available for the selected category
                                    const catSizes   = getFilteredVariantValues('sizes');
                                    const catColors  = getFilteredVariantValues('colors');
                                    const catWeights = getFilteredVariantValues('weights');

                                    // Priority: whichever type has values for this category
                                    let baseVariantType = null;
                                    let baseVariantLabel = null;
                                    let baseVariantOptions = [];

                                    if (catSizes.length > 0) {
                                        baseVariantType = 'size';
                                        baseVariantLabel = 'Base Size';
                                        baseVariantOptions = catSizes;
                                    } else if (catWeights.length > 0) {
                                        baseVariantType = 'weight';
                                        baseVariantLabel = 'Base Weight';
                                        baseVariantOptions = catWeights;
                                    } else if (catColors.length > 0) {
                                        baseVariantType = 'color';
                                        baseVariantLabel = 'Base Color';
                                        baseVariantOptions = catColors;
                                    }

                                    // When variants exist, total_stock is auto-calculated from their stocks
                                    const hasVariants = variants.length > 0;
                                    const variantTotalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

                                    return (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label>Base Price (₱) *</Label>
                                                    <Input type="number" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                                                </div>

                                                {/* Dynamic base variant field — shows Size, Weight, or Color based on category */}
                                                {baseVariantType ? (
                                                    <div className="space-y-1.5">
                                                        <Label>{baseVariantLabel} <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                                                        <select
                                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                            value={form.base_size}
                                                            onChange={e => setForm({ ...form, base_size: e.target.value })}
                                                        >
                                                            <option value="">Regular</option>
                                                            {baseVariantOptions.map(o => (
                                                                <option key={o.id} value={o.label}>{o.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <Label>Variant Type <span className="text-muted-foreground font-normal text-xs">(select a category first)</span></Label>
                                                        <div className="h-9 flex items-center px-3 rounded-md border border-input bg-secondary/40 text-sm text-muted-foreground">
                                                            Set category to see options
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Base Stock — always editable, independent from variant stocks */}
                                                <div className="space-y-1.5">
                                                    <Label>
                                                        Base Stock * <span className="text-muted-foreground font-normal text-xs">{hasVariants ? '(Regular option)' : ''}</span>
                                                    </Label>
                                                    <Input 
                                                        type="number" 
                                                        min="0" 
                                                        required
                                                        className="font-bold text-base"
                                                        value={form.total_stock} 
                                                        onChange={e => setForm({ ...form, total_stock: e.target.value })} 
                                                        placeholder="0"
                                                    />
                                                    {hasVariants && (
                                                        <p className="text-xs text-blue-600">This is the "Regular" option stock. Each variant below has its own separate stock.</p>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label>Min Order Qty</Label>
                                                    <Input type="number" min="1" value={form.min_order_qty} onChange={e => setForm({ ...form, min_order_qty: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                                                <Checkbox id="promoted" checked={form.is_promoted} onCheckedChange={v => setForm({ ...form, is_promoted: v })} />
                                                <Label htmlFor="promoted" className="cursor-pointer font-semibold text-sm">Promote to Admin (Make visible in admin catalog)</Label>
                                            </div>
                                        </>
                                    );
                                })()}
                            </Card>

                            {/* Variants */}
                            <Card className="p-5">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h3 className="font-bold text-foreground">Product Variants <span className="text-muted-foreground font-normal text-sm">(optional)</span></h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">Add variants if this product comes in multiple sizes, colors, or weights. Leave empty if the base product above stands alone.</p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={addVariant}><Plus className="h-3 w-3 mr-1" /> Add Variant</Button>
                                </div>

                                {variants.length === 0 ? (
                                    <div className="py-8 text-center bg-secondary/50 rounded-xl border border-dashed border-border">
                                        <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                                        <p className="text-sm text-muted-foreground">No variants added yet. Add variants for size, color, or weight options.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {variants.map((v, idx) => (
                                            <Card key={idx} className="p-4 bg-secondary/30 border-2">
                                                <div className="flex items-center gap-4">
                                                    {/* Variant Image */}
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
                                                                <img src={variantImagePreviews[idx]} alt="Variant" className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                                    <Plus className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            <label className="flex w-20 h-20 rounded-xl border-2 border-dashed border-border overflow-hidden bg-secondary/30 flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-orange-300 transition-all group m-0">
                                                                <Upload className="h-5 w-5 text-muted-foreground opacity-30 group-hover:scale-110 group-hover:text-orange-500 transition-all" />
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={(e) => handleVariantImageChange(idx, e)}
                                                                    className="hidden"
                                                                />
                                                            </label>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 grid grid-cols-3 gap-3">
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground mb-1">Size</Label>
                                                            <select 
                                                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                                value={v.size} 
                                                                onChange={e => updateVariant(idx, 'size', e.target.value)}
                                                            >
                                                                <option value="">Select Size</option>
                                                                {getFilteredVariantValues('sizes').map(s => (
                                                                    <option key={s.id} value={s.label}>{s.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground mb-1">Color</Label>
                                                            <select 
                                                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                                value={v.color} 
                                                                onChange={e => updateVariant(idx, 'color', e.target.value)}
                                                            >
                                                                <option value="">Select Color</option>
                                                                {getFilteredVariantValues('colors').map(c => (
                                                                    <option key={c.id} value={c.label}>{c.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground mb-1">Weight</Label>
                                                            <select 
                                                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                                value={v.weight} 
                                                                onChange={e => updateVariant(idx, 'weight', e.target.value)}
                                                            >
                                                                <option value="">Select Weight</option>
                                                                {getFilteredVariantValues('weights').map(w => (
                                                                    <option key={w.id} value={w.label}>{w.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground mb-1">Stock</Label>
                                                            <Input className="h-8 text-sm" type="number" placeholder="0" value={v.stock} onChange={e => updateVariant(idx, 'stock', e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground mb-1">Price Override (₱)</Label>
                                                            <Input className="h-8 text-sm" type="number" step="0.01" placeholder="Optional" value={v.price_override} onChange={e => updateVariant(idx, 'price_override', e.target.value)} />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="sm"
                                                                className="h-8 w-full"
                                                                onClick={() => removeVariant(idx)}
                                                            >
                                                                <X className="h-3.5 w-3.5 mr-1" /> Remove
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>

                        {/* Right: Image & Preview */}
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
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
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
                                             <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="hidden"
                                             />
                                         </label>
                                     )}
                                 </div>
                             </Card>

                            {editing && (
                                <Card className="p-5">
                                    <h3 className="font-bold text-foreground mb-3">Status</h3>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
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

                {/* Image Gallery Modal */}
                <Modal
                    isOpen={imageModalOpen}
                    onClose={() => setImageModalOpen(false)}
                    title={`Manage Gallery - ${imageModalTarget === 'base' ? 'Main Product' : `Variant #${Number(imageModalTarget) + 1}`}`}
                    size="lg"
                >
                    <div className="space-y-8 py-2 pb-8 px-2">
                        {/* Main Image Selection */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-sm font-bold flex items-center gap-2">
                                    <Package className="h-4 w-4 text-orange-500" /> Main Showcased Photo
                                </Label>
                                {(imageModalTarget === 'base' ? imagePreview : variantImagePreviews[imageModalTarget]) && (
                                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">Active</Badge>
                                )}
                            </div>
                            <div className="relative aspect-video rounded-2xl bg-secondary/20 border-2 border-dashed border-border flex items-center justify-center overflow-hidden group hover:border-orange-200 transition-all">
                                {(imageModalTarget === 'base' ? imagePreview : variantImagePreviews[imageModalTarget]) ? (
                                    <>
                                        <img 
                                            src={imageModalTarget === 'base' ? imagePreview : variantImagePreviews[imageModalTarget]} 
                                            className="w-full h-full object-contain p-4" 
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                            <label className="bg-white text-foreground rounded-full px-4 py-2 text-xs font-bold cursor-pointer hover:bg-orange-50 transition-colors shadow-xl">
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
                                                onClick={() => imageModalTarget === 'base' ? (setForm({...form, image: null}), setImagePreview(null)) : removeVariantImage(imageModalTarget)}
                                                className="bg-destructive text-white rounded-full p-2.5 shadow-xl hover:scale-110 transition-transform"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/40 transition-colors group">
                                        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                            <Upload className="h-8 w-8 text-orange-500" />
                                        </div>
                                        <span className="text-sm font-bold text-foreground">Upload Main Product Photo</span>
                                        <span className="text-[11px] text-muted-foreground mt-1">Recommended size: 800x800px</span>
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

                        {/* Additional Photos Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <Label className="text-sm font-bold flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-orange-500" /> Extra Gallery Photos
                                </Label>
                                <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Max 3</span>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                                {[0, 1, 2].map(i => {
                                    let preview = null;
                                    let isExisting = false;
                                    
                                    if (imageModalTarget === 'base') {
                                        isExisting = i < (existingAdditionalImages || []).length;
                                        preview = additionalImagePreviews[i];
                                    } else {
                                        const v = variants[imageModalTarget];
                                        isExisting = v?.existing_extra_images && v.existing_extra_images[i];
                                        preview = (variantExtraPreviews[imageModalTarget] || [])[i];
                                    }

                                    return (
                                        <div key={i} className="group relative aspect-square rounded-2xl bg-secondary/10 border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-orange-200 transition-all">
                                            {preview ? (
                                                <>
                                                    <img src={preview} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => imageModalTarget === 'base' ? removeAdditionalImage(i, isExisting) : removeVariantExtraImage(imageModalTarget, i, isExisting)}
                                                            className="bg-destructive text-white rounded-full p-2.5 shadow-xl hover:scale-110 transition-transform"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/30 transition-colors">
                                                    <Plus className="h-6 w-6 text-orange-300 group-hover:scale-110 transition-transform mb-1" />
                                                    <span className="text-[10px] font-bold text-muted-foreground">Add Photo</span>
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
                            <p className="text-[11px] text-muted-foreground mt-4 text-center italic bg-orange-50/50 py-2 rounded-lg border border-orange-100">
                                 These images appear as thumbnails below your main photo in the store catalog.
                            </p>
                        </div>
                    </div>
                </Modal>
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
                    <Package className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-30" />
                    <h3 className="text-lg font-bold text-foreground mb-2">No Products Yet</h3>
                    <p className="text-muted-foreground mb-6">Start adding products to promote to admin buyers.</p>
                    <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Your First Product</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {products.data.map(p => {
                        const imgSrc = p.image_path ? `/storage/${p.image_path}` : null;
                        const hasVariants = (p.variants?.length || 0) > 0;
                        
                        return (
                            <Card key={p.id} className="group overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-2 border-transparent hover:border-primary/20" onClick={() => openEdit(p)}>
                                {/* Product Image */}
                                <div className="relative aspect-square bg-gradient-to-br from-secondary to-secondary/50 overflow-hidden">
                                    {imgSrc ? (
                                        <img 
                                            src={imgSrc} 
                                            alt={p.name} 
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextElementSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div className={`absolute inset-0 flex items-center justify-center ${imgSrc ? 'hidden' : 'flex'}`}>
                                        <Package className="h-16 w-16 text-muted-foreground opacity-20" />
                                    </div>
                                    
                                    {/* Promoted Badge */}
                                    {p.is_promoted && (
                                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-white text-center py-1.5 text-[10px] font-extrabold tracking-widest uppercase">
                                            ⭐ Featured Product
                                        </div>
                                    )}
                                    
                                    {/* Status Badge */}
                                    <div className="absolute bottom-2 right-2">
                                        <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="text-[10px] font-bold shadow-lg">
                                            {p.status === 'active' ? '● ACTIVE' : '○ INACTIVE'}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Product Info */}
                                <div className="p-4 bg-white">
                                    {/* Category */}
                                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary mb-1.5">
                                        {p.category?.name || 'Uncategorized'}
                                    </div>
                                    
                                    {/* Product Name */}
                                    <h3 className="font-bold text-foreground text-sm leading-tight mb-2 line-clamp-2 min-h-[2.5rem]">
                                        {p.name}
                                    </h3>
                                    
                                    {/* Description Preview */}
                                    {p.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                                            {p.description}
                                        </p>
                                    )}
                                    
                                    {/* Stock & Variants Info */}
                                    <div className="flex items-center gap-2 mb-3">
                                        {/* Stock Badge */}
                                        <Badge 
                                            variant={p.total_stock > 0 ? "default" : "destructive"} 
                                            className="text-[10px] font-bold"
                                        >
                                            📦 {p.total_stock || 0} in stock
                                        </Badge>
                                        
                                        {/* Variants Badge */}
                                        {hasVariants && (
                                            <Badge variant="outline" className="text-[10px] font-semibold">
                                                {p.variants.length} variant{p.variants.length !== 1 ? 's' : ''}
                                            </Badge>
                                        )}
                                    </div>
                                    
                                    {/* Pricing Section - BOLD & PROMINENT */}
                                    <div className="pt-3 border-t border-border/50">
                                        <div className="flex items-baseline justify-between">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Price</div>
                                                <div className="text-2xl font-black text-foreground">
                                                    ₱{Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            {p.min_order_qty > 1 && (
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Min Order</div>
                                                    <div className="text-sm font-bold text-foreground">{p.min_order_qty} units</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Pagination page={page} total={products.total} perPage={15} onChange={setPage} />

            {/* Delete Confirm */}
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
