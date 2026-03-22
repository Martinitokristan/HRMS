import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import Modal from '../shared/Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Store, ShoppingCart, Package } from 'lucide-react';
import VariantSelector from '../shared/VariantSelector';

export default function SupplierCatalog() {
    const { showToast } = useToast();
    const [products, setProducts] = useState({ data: [], total: 0 });
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');
    const [promotedOnly, setPromotedOnly] = useState(false);
    const [viewProduct, setViewProduct] = useState(null);
    const [orderQty, setOrderQty] = useState(1);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState({ size: '', color: '', weight: '' });
    const [activeGalleryImage, setActiveGalleryImage] = useState(null);

    useEffect(() => { fetchProducts(); }, [page, search, categoryFilter, supplierFilter, promotedOnly]);
    useEffect(() => {
        axios.get('/categories').then(r => setCategories(r.data.data || [])).catch(() => { });
        axios.get('/suppliers').then(r => {
            const d = r.data.data;
            setSuppliers(Array.isArray(d) ? d : d?.data || []);
        }).catch(() => { });
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = { page, per_page: 20 };
            if (search) params.search = search;
            if (categoryFilter) params.category_id = categoryFilter;
            if (supplierFilter) params.supplier_id = supplierFilter;
            if (promotedOnly) params.promoted = 1;
            const res = await axios.get('/supplier-catalog', { params });
            setProducts(res.data.data);
        } catch (e) {
            showToast('Failed to load supplier catalog', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOrder = async () => {
        const variants = (viewProduct?.variants || []);
        const hasVariants = variants.length > 0;

        if (!viewProduct || orderQty < (viewProduct.min_order_qty || 1)) {
            showToast('Please enter a valid quantity.', 'error');
            return;
        }

        // Check stock for whichever option is selected
        const availableStock = selectedVariant ? selectedVariant.stock : viewProduct.total_stock;
        if (availableStock <= 0) {
            showToast('This option is out of stock.', 'error');
            return;
        }
        if (orderQty > availableStock) {
            showToast(`Only ${availableStock} units available for this option.`, 'error');
            return;
        }

        // Determine the price to use: variant price override > base product price
        const unitCost = selectedVariant?.price_override ?? viewProduct.price;

        setActionLoading(true);
        try {
            await axios.post('/purchase-orders', {
                supplier_id: viewProduct.supplier_id,
                items: [{
                    supplier_product_id: viewProduct.id,
                    supplier_product_variant_id: selectedVariant ? selectedVariant.id : null,
                    quantity: orderQty,
                    unit_cost: unitCost,
                }]
            });
            showToast('Order request sent to supplier!', 'success');
            setViewProduct(null);
            setSelectedVariant(null);
            setSelectedOptions({ size: '', color: '', weight: '' });
            setOrderQty(1);
            // Refresh catalog so new stock counts are visible immediately
            fetchProducts();
        } catch (e) {
            showToast(e.response?.data?.message || 'Failed to place order.', 'error');
        } finally {
            setActionLoading(false);
        }
    };


    return (
        <div className="relative">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3 relative z-0">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Store className="h-6 w-6 text-primary" /> Supplier Product Catalog
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Browse products promoted by your suppliers. Create POs directly from here.</p>
                </div>
            </div>

            <div className="mb-4">
                <FilterBar
                    search={search}
                    onSearchChange={v => { setSearch(v); setPage(1); }}
                    filters={[
                        {
                            value: categoryFilter,
                            onChange: v => { setCategoryFilter(v); setPage(1); },
                            options: [
                                { value: '', label: 'All Categories' },
                                ...categories.map(c => ({ value: c.id, label: c.name }))
                            ]
                        },
                        {
                            value: supplierFilter,
                            onChange: v => { setSupplierFilter(v); setPage(1); },
                            options: [
                                { value: '', label: 'All Suppliers' },
                                ...suppliers.map(s => ({ value: s.id, label: s.name }))
                            ]
                        },
                    ]}
                />
            </div>

            <div className="flex items-center gap-2 mb-4">
                <Checkbox
                    id="promoted"
                    checked={promotedOnly}
                    onCheckedChange={(checked) => { setPromotedOnly(!!checked); setPage(1); }}
                />
                <Label htmlFor="promoted" className="text-sm font-semibold cursor-pointer">Show Promoted Products Only</Label>
            </div>

            {loading ? (
                <div className="text-center py-12"><div className="spinner mx-auto" /></div>
            ) : products.data?.length === 0 ? (
                <Card className="text-center py-16 px-8">
                    <Store className="h-10 w-10 mx-auto mb-2 opacity-30 text-muted-foreground" />
                    <h3 className="text-base font-bold text-foreground mb-1">No Supplier Products Found</h3>
                    <p className="text-sm text-muted-foreground">Suppliers haven't added any products yet.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {products.data.map(p => (
                        <Card
                            key={p.id}
                            onClick={() => setViewProduct(p)}
                            className={`overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${p.is_promoted ? 'border-2 border-primary shadow-md shadow-primary/10' : ''}`}
                        >
                            <div className="h-[180px] bg-secondary flex items-center justify-center relative overflow-hidden">
                                {p.image_path ? (
                                    <img src={`/storage/${p.image_path}`} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Package className="h-12 w-12 opacity-20 text-muted-foreground" />
                                )}
                                {p.is_promoted && (
                                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-white text-center py-1 text-[10px] font-bold tracking-wider uppercase">
                                        Promoted by Supplier
                                    </div>
                                )}
                            </div>
                            <div className="p-4">
                                <div className="font-bold text-foreground mb-1">{p.name}</div>
                                <div className="text-[12px] text-muted-foreground mb-1">{p.supplier?.name || 'Unknown Supplier'}</div>
                                <div className="text-[12px] text-muted-foreground mb-2">
                                    {p.category?.name || 'Uncategorized'} &bull; {p.variants?.length || 0} variant{p.variants?.length !== 1 ? 's' : ''}
                                </div>

                                {/* Stock Availability Badge */}
                                <div className="mb-3">
                                    <Badge
                                        variant={p.total_stock > 0 ? "default" : "destructive"}
                                        className="text-[10px] font-bold"
                                    >
                                        {p.total_stock > 0 ? `✓ ${p.total_stock} Available` : '✗ Out of Stock'}
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-lg text-primary">
                                        ₱{Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                    {p.min_order_qty > 1 && (
                                        <span className="text-[11px] text-muted-foreground font-medium">Min: {p.min_order_qty} units</span>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Pagination page={page} total={products.total} perPage={20} onChange={setPage} />

            {/* Product Detail Modal - Modern Design */}
            <Modal isOpen={!!viewProduct} onClose={() => { setViewProduct(null); setSelectedVariant(null); setSelectedOptions({ size: '', color: '', weight: '' }); setOrderQty(1); setActiveGalleryImage(null); }} title="Product Details" size="lg" hideFooter>
                {viewProduct && (() => {
                    const variants = (viewProduct.variants || []).map(v => ({
                        id: v.id,
                        size: v.size || '',
                        color: v.color || '',
                        weight: v.weight || '',
                        stock: v.stock || 0,
                        price_override: v.price_override || null,
                        color_hex: v.color_hex || null,
                        image_path: v.image_path || null,
                        additional_images: v.additional_images || []
                    }));
                    const hasVariants = variants.length > 0;

                    // selectedVariant === null means base/Regular is selected
                    const currentPrice = selectedVariant ? (selectedVariant.price_override || viewProduct.price) : viewProduct.price;
                    const currentStock = selectedVariant ? selectedVariant.stock : viewProduct.total_stock;
                    const isOutOfStock = currentStock <= 0;
                    const subtotal = currentPrice * orderQty;

                    // Helper to get variant label
                    const getVariantLabel = (v) => {
                        const parts = [];
                        if (v.size) parts.push(v.size);
                        if (v.color) parts.push(v.color);
                        if (v.weight) parts.push(v.weight);
                        return parts.join(' / ') || 'Variant';
                    };

                    // Image Gallery Logic
                    const mainImage = selectedVariant ? (selectedVariant.image_path || viewProduct.image_path) : viewProduct.image_path;
                    const additionalImages = selectedVariant ? (selectedVariant.additional_images || []) : (viewProduct.additional_images || []);
                    const allImages = [mainImage, ...additionalImages].filter(Boolean);
                    const displayImage = activeGalleryImage || mainImage;

                    return (
                        <div className="grid grid-cols-1 md:grid-cols-[1.2fr,1fr] gap-0">
                            {/* Left Side - Image & Gallery */}
                            <div className="bg-secondary/10 p-6 flex flex-col items-center border-r border-border">
                                {/* Main Image Box - FIXED SIZE */}
                                <div className="w-full aspect-square relative rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden mb-6">
                                    {displayImage ? (
                                        <img
                                            src={`/storage/${displayImage}`}
                                            alt={viewProduct.name}
                                            className="w-full h-full object-contain p-4"
                                        />
                                    ) : (
                                        <Package className="h-24 w-24 opacity-10 text-muted-foreground" />
                                    )}
                                </div>

                                {/* Thumbnails Row */}
                                {allImages.length > 1 && (
                                    <div className="flex flex-wrap justify-center gap-3">
                                        {allImages.map((img, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setActiveGalleryImage(img)}
                                                className={`w-16 h-16 rounded-xl border-2 transition-all overflow-hidden bg-white flex items-center justify-center p-1 ${displayImage === img
                                                        ? 'border-orange-500 shadow-md ring-2 ring-orange-100'
                                                        : 'border-border hover:border-orange-200'
                                                    }`}
                                            >
                                                <img src={`/storage/${img}`} className="w-full h-full object-contain rounded-lg" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Right Side - Details */}
                            <div className="p-6 flex flex-col">
                                {/* Category & Title */}
                                <div className="mb-4">
                                    <div className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-1">
                                        {viewProduct.category?.name || 'SUPPLIES'}
                                    </div>
                                    <h2 className="text-2xl font-bold text-foreground mb-2 leading-tight">
                                        {viewProduct.name}
                                    </h2>
                                    <div className="text-3xl font-bold text-orange-500">
                                        ₱{Number(currentPrice).toFixed(2)}
                                    </div>
                                </div>

                                {/* Stock Badge */}
                                <div className="mb-4">
                                    <Badge variant={isOutOfStock ? "destructive" : "success"} className="text-sm px-3 py-1">
                                        {isOutOfStock ? 'Out of Stock' : `${currentStock} units in stock`}
                                    </Badge>
                                </div>

                                {/* Barcode & Min Order */}
                                <div className="space-y-2 mb-4 text-sm">
                                    {viewProduct.barcode && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground font-semibold">Barcode:</span>
                                            <span className="font-mono text-foreground">{viewProduct.barcode}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground font-semibold">MIN ORDER QTY:</span>
                                        <span className="text-foreground">{viewProduct.min_order_qty || 1} units</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground font-semibold">SUPPLIER:</span>
                                        <span className="text-foreground">{viewProduct.supplier?.name}</span>
                                    </div>
                                </div>

                                {/* Description */}
                                {viewProduct.description && (
                                    <div className="mb-4">
                                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">DESCRIPTION</div>
                                        <p className="text-sm text-foreground leading-relaxed">{viewProduct.description}</p>
                                    </div>
                                )}

                                {/* Variants - show as clickable buttons with Regular as first option */}
                                {hasVariants && (
                                    <div className="mb-4">
                                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">SELECT OPTION</div>
                                        <div className="flex flex-wrap gap-2">
                                            {/* Regular / Base option */}
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedVariant(null); setOrderQty(viewProduct.min_order_qty || 1); setActiveGalleryImage(null); }}
                                                className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${selectedVariant === null
                                                        ? 'bg-white text-orange-500 border-orange-500 shadow-sm'
                                                        : 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                                                    }`}
                                            >
                                                Regular
                                            </button>

                                            {/* Each variant as its own button */}
                                            {variants.map(v => {
                                                const isSelected = selectedVariant?.id === v.id;
                                                const isOOS = v.stock <= 0;
                                                return (
                                                    <button
                                                        key={v.id}
                                                        type="button"
                                                        disabled={isOOS}
                                                        onClick={() => { setSelectedVariant(v); setSelectedOptions({ size: v.size, color: v.color, weight: v.weight }); setOrderQty(viewProduct.min_order_qty || 1); setActiveGalleryImage(null); }}
                                                        className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${isOOS ? 'opacity-40 cursor-not-allowed bg-secondary/50 border-transparent text-muted-foreground'
                                                                : isSelected ? 'bg-white text-orange-500 border-orange-500 shadow-sm'
                                                                    : 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                                                            }`}
                                                    >
                                                        {getVariantLabel(v)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Quantity & Order Button */}
                                <div className="mt-auto pt-4 border-t border-border">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex items-center border-2 border-gray-300 rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => setOrderQty(q => Math.max(viewProduct.min_order_qty || 1, q - 1))}
                                                className="px-3 py-2 hover:bg-secondary transition-colors text-lg font-bold"
                                            >
                                                −
                                            </button>
                                            <input
                                                type="number"
                                                value={orderQty}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    const minQty = viewProduct.min_order_qty || 1;
                                                    const maxQty = currentStock;
                                                    setOrderQty(Math.max(minQty, Math.min(maxQty, val)));
                                                }}
                                                min={viewProduct.min_order_qty || 1}
                                                max={currentStock}
                                                className="w-16 text-center border-x-2 border-gray-300 py-2 font-bold text-lg focus:outline-none"
                                            />
                                            <button
                                                onClick={() => setOrderQty(q => Math.min(currentStock, q + 1))}
                                                className="px-3 py-2 hover:bg-secondary transition-colors text-lg font-bold"
                                                disabled={orderQty >= currentStock}
                                            >
                                                +
                                            </button>
                                        </div>
                                        <span className="text-sm text-muted-foreground">{currentStock} unit{currentStock !== 1 ? 's' : ''} in stock</span>
                                    </div>
                                    <Button
                                        className="w-full h-12 text-base font-bold bg-orange-500 hover:bg-orange-600 text-white"
                                        onClick={handleOrder}
                                        disabled={actionLoading || isOutOfStock}
                                    >
                                        🛒 {actionLoading ? 'Sending...' : `Order (₱${subtotal.toFixed(2)})`}
                                    </Button>
                                </div>

                                {/* Footer Buttons */}
                                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                                    <Button variant="ghost" onClick={() => setViewProduct(null)}>Cancel</Button>
                                    <Button variant="outline">View Full Specs</Button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
}
