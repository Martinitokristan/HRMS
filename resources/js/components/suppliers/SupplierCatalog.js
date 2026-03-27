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
import { Store, ShoppingCart, Package, Minus, Plus, CheckCircle2 } from 'lucide-react';
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
            showToast('Failed to load supplier available products', 'error');
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
            // Refresh list so new stock counts are visible immediately
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
                        <Store className="h-6 w-6 text-primary" /> Supplier Available Products
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
            <Modal isOpen={!!viewProduct} onClose={() => { setViewProduct(null); setSelectedVariant(null); setSelectedOptions({ size: '', color: '', weight: '' }); setOrderQty(1); setActiveGalleryImage(null); }} title="" size="lg" hideFooter hideTitle>
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
                        <div className="flex flex-col md:flex-row overflow-hidden bg-white text-gray-900 border-none shadow-none">
                            {/* Left Side - Image & Gallery */}
                            <div className="md:w-[50%] p-8 flex flex-col items-center justify-center bg-gray-50/20">
                                {/* Main Image Box */}
                                <div className="w-full aspect-square relative rounded-2xl bg-white shadow-lg shadow-gray-200/50 border border-gray-100 flex items-center justify-center overflow-hidden mb-4">
                                    {/* Sale Badge Mock if needed - Or conditional if you have sale_price */}
                                    {/* <div className="absolute top-4 right-4 z-10">
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg">SALE -50% OFF</span>
                                    </div> */}
                                    
                                    {displayImage ? (
                                        <img
                                            src={`/storage/${displayImage}`}
                                            alt={viewProduct.name}
                                            className="w-full h-full object-contain p-3"
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
                                                className={`w-14 h-14 rounded-xl border-2 transition-all overflow-hidden bg-white flex items-center justify-center p-1 ${displayImage === img
                                                        ? 'border-orange-500 shadow-md ring-2 ring-orange-100'
                                                        : 'border-gray-200 hover:border-orange-200'
                                                    }`}
                                            >
                                                <img src={`/storage/${img}`} className="w-full h-full object-contain rounded-lg" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Right Side - Details */}
                            <div className="md:w-[50%] p-8 flex flex-col overflow-y-auto max-h-[85vh]">
                                {/* Top Nav-like spacing / Category */}
                                <div className="mb-3">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#FF5A1F] mb-0.5">
                                        {viewProduct.category?.name || 'SUPPLIES'}
                                    </div>
                                    <h2 className="text-xl font-black text-gray-900 mb-1 leading-tight tracking-tight">
                                        {viewProduct.name}
                                    </h2>
                                    
                                    {/* Description */}
                                    {viewProduct.description && (
                                        <p className="text-xs text-gray-500 leading-relaxed mb-2">
                                            {viewProduct.description}
                                        </p>
                                    )}
                                </div>

                                {/* Stock Badge */}
                                <div className="mb-4">
                                    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                        isOutOfStock 
                                            ? 'bg-red-50 text-red-600 border border-red-100' 
                                            : 'bg-green-50 text-green-600 border border-green-100'
                                    }`}>
                                        {isOutOfStock ? (
                                            <>Out of Stock</>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                In Stock <span className="text-gray-900 ml-1">{currentStock} units</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Price Area */}
                                <div className="mb-4 bg-[#FFF9F6] border border-[#FFE7DB] rounded-xl p-4 relative overflow-hidden">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-[#FF5A1F]">
                                            ₱{Number(currentPrice).toFixed(2)}
                                        </span>
                                        {/* Original price placeholder if needed */}
                                        {/* <span className="text-sm text-gray-300 line-through">₱{(currentPrice * 1.5).toFixed(2)}</span>
                                        <span className="text-[10px] text-green-600 font-bold ml-1">You save ₱{(currentPrice * 0.5).toFixed(2)}</span> */}
                                    </div>
                                </div>

                                {/* Labels / Meta Data Section */}
                                <div className="grid grid-cols-1 gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                                    {viewProduct.barcode && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-400 font-bold uppercase tracking-wider">Barcode</span>
                                            <span className="font-mono font-bold text-gray-700">{viewProduct.barcode}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-400 font-bold uppercase tracking-wider">Min Order</span>
                                        <span className="font-bold text-gray-700">{viewProduct.min_order_qty || 1} units</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-right">
                                        <span className="text-gray-400 font-bold uppercase tracking-wider">Supplier</span>
                                        <span className="font-bold text-gray-700">{viewProduct.supplier?.name}</span>
                                    </div>
                                </div>

                                {/* Variants Section */}
                                {hasVariants && (
                                    <div className="mb-4">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">SELECT OPTION</div>
                                        <div className="flex flex-wrap gap-2">
                                            {/* Regular Option */}
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedVariant(null); setOrderQty(viewProduct.min_order_qty || 1); setActiveGalleryImage(null); }}
                                                className={`px-4 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${selectedVariant === null
                                                        ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-md shadow-orange-200 scale-105'
                                                        : 'bg-white text-gray-700 border-gray-100 hover:border-orange-200'
                                                    }`}
                                            >
                                                Regular
                                            </button>

                                            {/* Map over variants */}
                                            {variants.map(v => {
                                                const isSelected = selectedVariant?.id === v.id;
                                                const isOOS = v.stock <= 0;
                                                return (
                                                    <button
                                                        key={v.id}
                                                        type="button"
                                                        disabled={isOOS}
                                                        onClick={() => { setSelectedVariant(v); setSelectedOptions({ size: v.size, color: v.color, weight: v.weight }); setOrderQty(viewProduct.min_order_qty || 1); setActiveGalleryImage(null); }}
                                                        className={`px-4 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${isOOS ? 'opacity-40 cursor-not-allowed bg-gray-100 border-transparent text-gray-400'
                                                                : isSelected ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] shadow-md shadow-orange-200 scale-105'
                                                                    : 'bg-white text-gray-700 border-gray-100 hover:border-orange-200'
                                                            }`}
                                                    >
                                                        {getVariantLabel(v)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Quantity Selector */}
                                <div className="mb-6">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">QUANTITY</div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
                                            <button
                                                onClick={() => setOrderQty(q => Math.max(viewProduct.min_order_qty || 1, q - 1))}
                                                className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-500"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="w-10 text-center font-bold text-gray-900 border-x border-gray-100 text-sm">
                                                {orderQty}
                                            </div>
                                            <button
                                                onClick={() => setOrderQty(q => Math.min(currentStock, q + 1))}
                                                className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-500"
                                                disabled={orderQty >= currentStock}
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* CTA Action Button */}
                                <div className="mt-auto">
                                    <Button
                                        className="w-full h-12 rounded-xl text-base font-black bg-[#FF5A1F] hover:bg-[#e44e18] text-white shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-3 active:scale-95"
                                        onClick={handleOrder}
                                        disabled={actionLoading || isOutOfStock}
                                    >
                                        <ShoppingCart className="w-5 h-5" />
                                        {actionLoading ? 'PROCESSING...' : isOutOfStock ? 'OUT OF STOCK' : `Order — ₱${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
}
