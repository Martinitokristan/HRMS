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
import { Store, ShoppingCart } from 'lucide-react';

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

    useEffect(() => { fetchProducts(); }, [page, search, categoryFilter, supplierFilter, promotedOnly]);
    useEffect(() => {
        axios.get('/categories').then(r => setCategories(r.data.data || [])).catch(() => {});
        axios.get('/suppliers').then(r => {
            const d = r.data.data;
            setSuppliers(Array.isArray(d) ? d : d?.data || []);
        }).catch(() => {});
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
        if (!viewProduct || orderQty < (viewProduct.min_order_qty || 1)) {
            showToast('Please enter a valid quantity.', 'error');
            return;
        }
        setActionLoading(true);
        try {
            await axios.post('/purchase-orders', {
                supplier_id: viewProduct.supplier_id,
                items: [{
                    supplier_product_id: viewProduct.id,
                    quantity: orderQty,
                    unit_cost: viewProduct.price
                }]
            });
            showToast('Order request sent to supplier!', 'success');
            setViewProduct(null);
            setOrderQty(1);
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
                    <div className="text-4xl mb-2 opacity-50">🏪</div>
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
                                    <span className="text-5xl opacity-30">📦</span>
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
                                <div className="text-[12px] text-muted-foreground mb-3">
                                    {p.category?.name || 'Uncategorized'} &bull; {p.variants?.length || 0} variant{p.variants?.length !== 1 ? 's' : ''}
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

            {/* Product Detail Modal */}
            <Modal isOpen={!!viewProduct} onClose={() => setViewProduct(null)}
                title={viewProduct?.name || 'Product Details'} size="lg" hideFooter>
                {viewProduct && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="rounded-xl overflow-hidden bg-secondary h-[280px] flex items-center justify-center">
                                {viewProduct.image_path ? (
                                    <img src={`/storage/${viewProduct.image_path}`} alt={viewProduct.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-6xl opacity-20">📦</span>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Supplier</div>
                                    <div className="font-bold text-lg text-foreground">{viewProduct.supplier?.name}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</div>
                                    <div className="text-foreground">{viewProduct.category?.name || 'Uncategorized'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Base Price</div>
                                    <div className="font-bold text-2xl text-primary">
                                        ₱{Number(viewProduct.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Min Order Qty</div>
                                    <div className="text-foreground">{viewProduct.min_order_qty || 1} units</div>
                                </div>
                                {viewProduct.sku && (
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SKU</div>
                                        <Badge variant="outline" className="font-mono">{viewProduct.sku}</Badge>
                                    </div>
                                )}
                                {viewProduct.description && (
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Description</div>
                                        <p className="text-sm text-foreground leading-relaxed">{viewProduct.description}</p>
                                    </div>
                                )}
                                <Card className="bg-secondary/50 p-4 mt-4">
                                    <div className="flex items-end gap-3">
                                        <div className="flex-1 space-y-1.5">
                                            <Label className="text-[11px] font-bold">Quantity to Order</Label>
                                            <Input
                                                type="number"
                                                min={viewProduct.min_order_qty || 1}
                                                value={orderQty}
                                                onChange={(e) => setOrderQty(parseInt(e.target.value) || 1)}
                                            />
                                        </div>
                                        <div className="flex-[2]">
                                            <Button className="w-full gap-2" onClick={handleOrder} disabled={actionLoading}>
                                                <ShoppingCart className="h-4 w-4" />
                                                {actionLoading ? 'Sending...' : `Order (₱${(viewProduct.price * orderQty).toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* Variants */}
                        {viewProduct.variants?.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-foreground mb-3">Available Variants</h4>
                                <Card className="overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Size</TableHead>
                                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Color</TableHead>
                                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Weight</TableHead>
                                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Stock</TableHead>
                                                <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Price</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {viewProduct.variants.map(v => (
                                                <TableRow key={v.id}>
                                                    <TableCell className="px-4 py-3">{v.size || '-'}</TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        {v.color ? (
                                                            <span className="flex items-center gap-1.5">
                                                                <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{ background: v.color }} />
                                                                {v.color}
                                                            </span>
                                                        ) : '-'}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3">{v.weight || '-'}</TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <Badge variant="outline" className={v.stock > 0 ? 'border-success/30 bg-success-light text-success-foreground' : 'border-destructive/30 bg-destructive/5 text-destructive'}>
                                                            {v.stock > 0 ? `${v.stock} in stock` : 'Out of stock'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 font-bold text-foreground">
                                                        {v.price_override ? `₱${Number(v.price_override).toFixed(2)}` : 'Base price'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button variant="outline" onClick={() => setViewProduct(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
