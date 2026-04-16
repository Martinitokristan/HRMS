import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { sileo } from 'sileo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Percent, Tag, Barcode, Plus, Trash2, Upload, Image, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ProductForm({ product, categories, suppliers, unitTypes, variants, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [brands, setBrands] = useState([]);
    const [errors, setErrors] = useState({});

    const [variantValues, setVariantValues] = useState({ sizes: [], colors: [], weights: [] });
    
    useEffect(() => { 
        fetchVariantValues();
        fetchBrands();
    }, []);

    const fetchBrands = async () => {
        try {
            const res = await api.get('/brands');
            const data = res.data?.data !== undefined ? res.data.data : (res.data || []);
            setBrands(Array.isArray(data) ? data : []);
        } catch (e) {
            // Brands are optional - silently fail
        }
    };

    // Fetch variant values for fallback when relationships fail
    const fetchVariantValues = async () => {
        try {
            const res = await api.get('/supplier/variant-values');
            const variantData = res.data?.data !== undefined ? res.data.data : (res.data || []);
            
            if (Array.isArray(variantData)) {
                // Organize by variant type: 1=Size, 2=Color, 3=Weight
                const sizes = variantData.filter(v => v.variant_id === 1);
                const colors = variantData.filter(v => v.variant_id === 2);
                const weights = variantData.filter(v => v.variant_id === 3);
                setVariantValues({ sizes, colors, weights });
            }
        } catch (e) { 
            // Silently fail - variant values are optional
        }
    };

    // Helper function to get variant label by ID
    const getVariantLabelById = (id, type) => {
        if (!id) return 'No ' + type;
        
        let variantList = [];
        if (type === 'size') variantList = variantValues.sizes || [];
        if (type === 'color') variantList = variantValues.colors || [];
        if (type === 'weight') variantList = variantValues.weights || [];
        
        const variant = Array.isArray(variantList) ? variantList.find(v => v.id === parseInt(id)) : null;
        return variant ? variant.label : `${type.charAt(0).toUpperCase() + type.slice(1)} ID: ${id}`;
    };

    const [form, setForm] = useState({
        name: '', 
        barcode: '', 
        category_id: '', 
        supplier_id: '', 
        unit_type_id: '',
        brand_id: '',
        purchase_price: '', 
        sell_price: '', 
        sale_percentage: '',
        description: ''
    });

    const [variantEnabled, setVariantEnabled] = useState(false);
    const [variantRows, setVariantRows] = useState([]);
    const [saleSettings, setSaleSettings] = useState({
        enableSale: false,
        applyToVariants: false,
        baseProductSale: 0,
        variantSales: {}
    });

    const sizeVariant = Array.isArray(variants) ? variants.find(v => v.name?.toLowerCase() === 'size') : null;
    const colorVariant = Array.isArray(variants) ? variants.find(v => v.name?.toLowerCase() === 'color') : null;
    const weightVariant = Array.isArray(variants) ? variants.find(v => v.id === 3 || v.name?.toLowerCase().includes('weight') || v.name?.toLowerCase().includes('gram')) : null;

    useEffect(() => {
        setErrors({});

        if (product) {
            setForm({
                name: product.name || '',
                barcode: product.barcode || '',
                category_id: product.category_id || '',
                supplier_id: product.supplier_id || '',
                unit_type_id: product.unit_type_id || '',
                brand_id: product.brand_id || '',
                purchase_price: product.purchase_price || '',
                sell_price: product.sell_price || '',
                sale_percentage: product.sale_percentage || '',
                description: product.description || '',
            });

            const pvs = Array.isArray(product.product_variants) ? product.product_variants : [];
            if (pvs.length > 0) {
                setVariantEnabled(true);
                setVariantRows(pvs.map(pv => {
                    return {
                        id: pv.id || Math.random(),
                        size_value: pv.size_value?.label || getVariantLabelById(pv.size_value_id, 'size'),
                        color_value: pv.color_value?.label || getVariantLabelById(pv.color_value_id, 'color'),
                        weight_value: pv.weight_value?.label || getVariantLabelById(pv.weight_value_id, 'weight'),
                        stock: pv.stock || 0,
                        price_override: pv.price_override || '',
                        barcode: pv.barcode || pv.barcode_suffix || product.barcode || 'No Barcode',
                        sale_percentage: pv.sale_percentage || '',
                        imageFile: null,
                        imagePreview: pv.image_path ? `/storage/${pv.image_path}` : null,
                        existing_image_path: pv.image_path || null,
                        _original: pv
                    };
                }));

                const variantSales = {};
                pvs.forEach(pv => {
                    if (pv.id) {
                        variantSales[pv.id] = pv.sale_percentage || 0;
                    }
                });
                setSaleSettings(prev => ({
                    ...prev,
                    variantSales,
                    applyToVariants: pvs.some(pv => pv.sale_percentage > 0)
                }));
            } else {
                setVariantEnabled(false);
                setVariantRows([]);
            }
        } else {
            setForm({ 
                name: '', 
                barcode: '', 
                category_id: '', 
                supplier_id: '', 
                unit_type_id: '', 
                brand_id: '',
                purchase_price: '', 
                sell_price: '', 
                sale_percentage: '',
                description: '' 
            });
            setVariantEnabled(false);
            setVariantRows([]);
        }
    }, [product]);

    const handleAddRow = () => {
        setVariantRows(prev => [
            ...prev,
            { 
                id: Date.now() + Math.random(), 
                size_value: 'No Size', 
                color_value: 'No Color', 
                weight_value: 'No Weight', 
                stock: 0, 
                price_override: '', 
                barcode: '', 
                sale_percentage: '',
                imageFile: null, 
                imagePreview: null, 
                existing_image_path: null 
            }
        ]);
    };

    const handleRemoveRow = (id) => setVariantRows(prev => prev.filter(r => r.id !== id));
    
    const handleRowChange = (id, field, value) => {
        if (field === 'sale_percentage') {
            setVariantRows(prev => (Array.isArray(prev) ? prev : []).map(r => r.id === id ? { ...r, [field]: value } : r));
            
            setSaleSettings(prev => ({
                ...prev,
                variantSales: {
                    ...prev.variantSales,
                    [id]: parseFloat(value) || 0
                }
            }));
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        
        if (name === 'sale_percentage') {
            setSaleSettings(prev => ({
                ...prev,
                baseProductSale: parseFloat(value) || 0
            }));
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        setLoading(true);
        setErrors({});

        const fd = new FormData();
        Object.keys(form).forEach(k => {
            if (k === 'sale_percentage') {
                fd.append(k, form[k] || 0);
            } else if (form[k] !== '' && form[k] !== null) {
                fd.append(k, form[k]);
            }
        });

        fd.append('sale_settings', JSON.stringify(saleSettings));

        const variantList = variantEnabled && Array.isArray(variantRows)
            ? variantRows.map((row, index) => {
                if (row.imageFile) {
                    fd.append(`variant_image_${index}`, row.imageFile);
                }
                return {
                    size_value_id: row.size_value !== 'Regular' ? (sizeVariant?.values?.find(v => v.label === row.size_value)?.id || null) : null,
                    color_value_id: row.color_value !== 'Regular' ? (colorVariant?.values?.find(v => v.label === row.color_value)?.id || null) : null,
                    weight_value_id: row.weight_value !== 'Regular' ? (weightVariant?.values?.find(v => v.label === row.weight_value)?.id || null) : null,
                    stock: row.stock || 0,
                    price_override: row.price_override !== '' && row.price_override !== null && row.price_override !== undefined
                        ? row.price_override : null,
                    barcode: row.barcode || null,
                    sale_percentage: row.sale_percentage || 0,
                    existing_image_path: row.existing_image_path || null,
                };
            })
            : [];
        fd.append('variants', JSON.stringify(variantList));

        try {
            if (product) {
                fd.append('_method', 'PUT');
                await api.post(`/products/${product.id}`, fd);
                sileo.success('Product updated successfully');
            } else {
                await api.post('/products', fd);
                sileo.success('Product created successfully');
            }
            onSuccess();
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors || {});
                sileo.error('Please check the highlighted fields.');
            } else {
                sileo.error(err.response?.data?.message || 'Error saving product');
            }
        } finally {
            setLoading(false);
        }
    };

    const calculateSalePrice = (originalPrice, percentage) => {
        if (!originalPrice || !percentage) return originalPrice;
        return (originalPrice * (1 - percentage / 100)).toFixed(2);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        {product ? 'Edit Product' : 'New Product'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="basic" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger value="variants">Variants</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Product Name *</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        value={form.name}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Premium Polo Shirt"
                                        className={errors.name ? 'border-red-500' : ''}
                                        disabled={!!product} 
                                    />
                                    {errors.name && <p className="text-sm text-red-500">{errors.name[0]}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="barcode">Barcode *</Label>
                                    <div className="flex items-center gap-2">
                                        <Barcode className="w-4 h-4 text-gray-500" />
                                        <Input
                                            id="barcode"
                                            name="barcode"
                                            value={form.barcode}
                                            onChange={handleInputChange}
                                            placeholder="e.g. 1234567890123"
                                            className={errors.barcode ? 'border-red-500' : ''}
                                            disabled={!!product} 
                                        />
                                    </div>
                                    {errors.barcode && <p className="text-sm text-red-500">{errors.barcode[0]}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="category_id">Category *</Label>
                                    <Select 
                                        value={form.category_id?.toString() || ''} 
                                        onValueChange={(value) => setForm(prev => ({ ...prev, category_id: value }))}
                                        disabled={!!product} 
                                    >
                                        <SelectTrigger className={errors.category_id ? 'border-red-500' : ''}>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(Array.isArray(categories) ? categories : []).map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.category_id && <p className="text-sm text-red-500">{errors.category_id[0]}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="supplier_id">Supplier</Label>
                                    <Select 
                                        value={form.supplier_id?.toString() || ''} 
                                        onValueChange={(value) => setForm(prev => ({ ...prev, supplier_id: value }))}
                                        disabled={!!product} 
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Supplier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(Array.isArray(suppliers) ? suppliers : []).map(s => (
                                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="brand_id">Brand</Label>
                                    <Select 
                                        value={form.brand_id?.toString() || ''} 
                                        onValueChange={(value) => setForm(prev => ({ ...prev, brand_id: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Brand (Optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">No Brand</SelectItem>
                                            {(Array.isArray(brands) ? brands : []).map(b => (
                                                <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="unit_type_id">Unit Type *</Label>
                                    <Select 
                                        value={form.unit_type_id?.toString() || ''} 
                                        onValueChange={(value) => setForm(prev => ({ ...prev, unit_type_id: value }))}
                                        disabled={!!product} 
                                    >
                                        <SelectTrigger className={errors.unit_type_id ? 'border-red-500' : ''}>
                                            <SelectValue placeholder="Select Unit Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(Array.isArray(unitTypes) ? unitTypes : []).map(u => (
                                                <SelectItem key={u.id} value={u.id.toString()}>
                                                    {u.purchase_unit} / {u.sell_unit}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.unit_type_id && <p className="text-sm text-red-500">{errors.unit_type_id[0]}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    value={form.description}
                                    onChange={handleInputChange}
                                    placeholder="Optional product notes..."
                                    disabled={!!product} 
                                />
                            </div>

                            {product && product.image_path && (
                                <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30">
                                    <Image className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">Carousel:</span>
                                    {product.image_banner_path ? (
                                        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                                            <CheckCircle className="w-3 h-3" />
                                            Product cutout ready
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
                                            <AlertTriangle className="w-3 h-3" />
                                            Cutout processing
                                        </Badge>
                                    )}
                                    {product.banner_bg_path ? (
                                        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                                            <CheckCircle className="w-3 h-3" />
                                            AI background ready
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
                                            <AlertTriangle className="w-3 h-3" />
                                            Background processing
                                        </Badge>
                                    )}
                                </div>
                            )}

                            <Separator />

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Pricing & Sale Information</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="purchase_price">Original Cost Price *</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                                            <Input
                                                id="purchase_price"
                                                name="purchase_price"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={form.purchase_price}
                                                onChange={handleInputChange}
                                                placeholder="0.00"
                                                className="pl-8"
                                                disabled={!!product} 
                                            />
                                        </div>
                                        {errors.purchase_price && <p className="text-sm text-red-500">{errors.purchase_price[0]}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="sell_price">Retail Price *</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                                            <Input
                                                id="sell_price"
                                                name="sell_price"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={form.sell_price}
                                                onChange={handleInputChange}
                                                placeholder="0.00"
                                                className="pl-8"
                                            />
                                        </div>
                                        {errors.sell_price && <p className="text-sm text-red-500">{errors.sell_price[0]}</p>}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Label className="flex items-center gap-2">
                                                <Percent className="w-4 h-4" />
                                                Enable Sale
                                            </Label>
                                            <p className="text-sm text-gray-500">Apply discount to this product</p>
                                        </div>
                                        <Switch
                                            checked={saleSettings.enableSale}
                                            onCheckedChange={(checked) => setSaleSettings(prev => ({ ...prev, enableSale: checked }))}
                                        />
                                    </div>

                                    {saleSettings.enableSale && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="sale_percentage">Sale Percentage (%)</Label>
                                                    <div className="relative">
                                                        <Input
                                                            id="sale_percentage"
                                                            name="sale_percentage"
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            max="100"
                                                            value={form.sale_percentage}
                                                            onChange={handleInputChange}
                                                            placeholder="0"
                                                        />
                                                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Sale Price</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                                                        <Input
                                                            value={calculateSalePrice(form.sell_price, form.sale_percentage)}
                                                            readOnly
                                                            className="pl-8 bg-green-50 border-green-200 text-green-700 font-bold"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {variantEnabled && (
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <Label>Apply to Variants</Label>
                                                        <p className="text-sm text-gray-500">Set individual sale percentages for variants</p>
                                                    </div>
                                                    <Switch
                                                        checked={saleSettings.applyToVariants}
                                                        onCheckedChange={(checked) => setSaleSettings(prev => ({ ...prev, applyToVariants: checked }))}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="variants" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="flex items-center gap-2">
                                        <Tag className="w-4 h-4" />
                                        Product Variants
                                    </Label>
                                    <p className="text-sm text-gray-500">View product variants and set sale percentages</p>
                                </div>
                            </div>

                            {variantEnabled && Array.isArray(variantRows) && variantRows.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="secondary">Variants Available</Badge>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 text-left">
                                                <tr>
                                                    <th className="px-4 py-2 text-sm font-medium">Image</th>
                                                    <th className="px-4 py-2 text-sm font-medium">Size</th>
                                                    <th className="px-4 py-2 text-sm font-medium">Color</th>
                                                    <th className="px-4 py-2 text-sm font-medium">Weight</th>
                                                    <th className="px-4 py-2 text-sm font-medium">Stock</th>
                                                    <th className="px-4 py-2 text-sm font-medium">Regular Price</th>
                                                    <th className="px-4 py-2 text-sm font-medium">Barcode</th>
                                                    <th className="px-4 py-2 text-sm font-medium">Sale %</th>
                                                    <th className="px-4 py-2 text-sm font-medium">Sale Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {variantRows.map((row) => (
                                                    <tr key={row.id} className="border-t hover:bg-secondary/20">
                                                        <td className="px-4 py-2">
                                                            <div className="flex items-center justify-center">
                                                                {row.imagePreview ? (
                                                                    <img src={row.imagePreview} alt="variant" className="w-8 h-8 object-cover rounded shadow-sm" />
                                                                ) : (
                                                                    <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center">
                                                                        <Package className="w-4 h-4 text-muted-foreground opacity-40" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-sm">{row.size_value || 'No Size'}</td>
                                                        <td className="px-4 py-2 text-sm">{row.color_value || 'No Color'}</td>
                                                        <td className="px-4 py-2 text-sm">{row.weight_value || 'No Weight'}</td>
                                                        <td className="px-4 py-2 text-sm font-semibold">{row.stock || 0}</td>
                                                        <td className="px-4 py-2 text-sm">₱{Number(row.price_override || form.sell_price || 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                                                            {row.barcode || row._original?.barcode || row._original?.barcode_suffix || 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <div className="relative">
                                                                <Input
                                                                    type="number"
                                                                    step="0.1"
                                                                    min="0"
                                                                    max="100"
                                                                    value={row.sale_percentage}
                                                                    onChange={e => handleRowChange(row.id, 'sale_percentage', e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-20 pr-8 h-8 text-xs"
                                                                />
                                                                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-[10px]">%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <div className="text-sm font-bold text-green-600">
                                                                ₱{calculateSalePrice(row.price_override || form.sell_price, row.sale_percentage)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground bg-secondary/20 rounded-xl border border-dashed">
                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm font-medium">No variants found</p>
                                    <p className="text-xs opacity-60 mt-1">This product is managed as a single item.</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
                <p className="text-sm text-muted-foreground">
                    {product ? `Editing Product: ${product.name}` : 'Creating New Product Master'}
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={onCancel} type="button" disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} type="button" className="px-8">
                        {loading ? 'Processing...' : product ? 'Update Product' : 'Create Product'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

