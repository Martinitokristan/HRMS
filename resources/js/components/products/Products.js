import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { sileo } from 'sileo';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import ConfirmModal from '../shared/ConfirmModal';
import ProductForm from './ProductForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';

export default function Products() {
    const { categories, unitTypes, settings, refreshCategories, refreshSettings, refreshUnitTypes } = useAuth();
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_PRODUCTS);
    const [products, setProducts] = useState({ data: [], total: 0, current_page: 1 });
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(products.data?.length === 0);
    
    // Filters & Pagination
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    
    // View: 'list' | 'form'
    const [view, setView] = useState('list');
    const [editingProduct, setEditingProduct] = useState(null);
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

    const openCreate = () => { setEditingProduct(null); setView('form'); };
    const openEdit   = (p) => { setEditingProduct(p);    setView('form'); };
    const closeForm  = () => { setEditingProduct(null); setView('list'); };

    useEffect(() => {
        refreshCategories();
        refreshSettings();
        refreshUnitTypes();
        
        let isMounted = true;
        api.get('/suppliers', { params: { no_pagination: 1 } })
            .then(res => {
                const data = res.data?.data || res.data || [];
                if (isMounted) setSuppliers(Array.isArray(data) ? data : []);
            })
            .catch(err => console.error("Failed to fetch suppliers:", err));
        return () => { isMounted = false; };
    }, []);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/products', { params: { page, search, category_id: categoryFilter } });
            // Handle different possible response structures
            const responseData = res.data?.data !== undefined ? res.data.data : res.data;
            
            if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
                // Standard Laravel Paginator (if not further wrapped)
                setProducts({
                    data: Array.isArray(responseData.data) ? responseData.data : [],
                    total: responseData.total !== undefined ? responseData.total : 0,
                    current_page: responseData.current_page || 1
                });
            } else if (Array.isArray(responseData)) {
                // Direct array response
                setProducts({
                    data: responseData,
                    total: responseData.length,
                    current_page: 1
                });
            } else {
                setProducts({ data: [], total: 0, current_page: 1 });
            }
        } catch (err) {
            console.error('Failed to fetch products:', err);
            sileo.error({ title: 'Failed to load products list' });
            setProducts({ data: [], total: 0, current_page: 1 });
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchData(products.data?.length > 0);
        }, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, categoryFilter, refreshTrigger]);

    const handleEdit = (product) => openEdit(product);

    const performDelete = async (id) => {
        closeConfirm();
        try {
            await api.delete(`/products/${id}`);
            sileo.success({ title: 'Product deleted successfully' });
            markStale(STALE_KEYS.ADMIN_PRODUCTS, STALE_KEYS.CUSTOMER_SHOP, STALE_KEYS.SUPPLIER_PRODUCTS);
            fetchData(true);
        } catch (err) {
            sileo.error({ title: 'Failed to delete product' });
        }
    };

    const handleDelete = (id) => {
        showConfirm(
            'Delete Product',
            'Are you sure you want to delete this product? This action cannot be undone.',
            () => performDelete(id),
            'destructive'
        );
    };

    // If form view, render ProductForm filling the content area
    if (view === 'form') {
        return (
            <ProductForm
                product={editingProduct}
                categories={categories}
                suppliers={suppliers}
                unitTypes={unitTypes}
                variants={settings?.variants || []}
                onSuccess={() => { 
                    closeForm(); 
                    markStale(STALE_KEYS.ADMIN_PRODUCTS, STALE_KEYS.CUSTOMER_SHOP, STALE_KEYS.SUPPLIER_PRODUCTS);
                    fetchData(true); 
                }}
                onCancel={closeForm}
            />
        );
    }

    return (
        <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-5">Products Masterlist</h2>

            <FilterBar 
                search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}
                filters={[
                    {
                        value: categoryFilter,
                        onChange: (v) => { setCategoryFilter(v); setPage(1); },
                        options: [
                            { value: '', label: 'All Categories' },
                            ...(Array.isArray(categories) ? categories.map(c => ({ value: c.id, label: c.name })) : [])
                        ]
                    }
                ]}
            />

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Barcode / Image</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Product Name</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Category</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-right">Supply Price</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-right">Retail Price</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Margin</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Stock</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-10"><div className="spinner mx-auto" /></TableCell></TableRow>
                        ) : (products.data?.length === 0) ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No products found.</TableCell></TableRow>
                        ) : products.data?.map(p => {
                            const margin = p.sell_price > 0 ? ((p.sell_price - p.purchase_price) / p.sell_price * 100).toFixed(1) : 0;
                            const firstImg = p.image_path || p.product_variants?.find(v => v.image_path)?.image_path;
                            const imgSrc = firstImg ? `/storage/${firstImg}` : null;
                            
                            return (
                                <TableRow key={p.id} className="hover:bg-secondary/30 transition-colors">
                                    <TableCell className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-secondary border-2 border-border flex-shrink-0">
                                                {imgSrc ? (
                                                    <img 
                                                        src={imgSrc} 
                                                        alt={p.name} 
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextElementSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div className={`absolute inset-0 flex items-center justify-center ${imgSrc ? 'hidden' : 'flex'}`}>
                                                    <Package className="h-5 w-5 text-muted-foreground opacity-40" />
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{p.barcode}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="font-bold text-foreground">{p.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{p.supplier?.name || 'In-house'}</div>
                                        {p.brand && (
                                            <div className="text-[10px] font-semibold text-orange-500 mt-0.5">{p.brand.name}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Badge variant="secondary" className="font-semibold">{p.category?.name || 'Uncategorized'}</Badge>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-right">
                                        <div className="text-sm text-muted-foreground font-medium">₱{Number(p.purchase_price || 0).toFixed(2)}</div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-right">
                                        <div className="text-base font-black text-foreground">₱{Number(p.sell_price || 0).toFixed(2)}</div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <Badge variant="outline" className={`font-bold ${margin > 20 ? 'border-success/30 bg-success-light text-success-foreground' : 'border-warning/30 bg-warning-light text-warning-foreground'}`}>
                                            {margin}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <div className="font-bold text-foreground">
                                            {p.product_variants?.length > 0 ? (
                                                <>
                                                    {p.product_variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)} pcs 
                                                    <div className="text-[10px] text-muted-foreground font-semibold">({p.product_variants.length} variants)</div>
                                                </>
                                            ) : (
                                                `${p.inventory?.current_stock || 0} pcs`
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="outline" size="sm" className="font-semibold" onClick={() => openEdit(p)}>Edit</Button>
                                            <Button variant="destructive" size="sm" className="font-semibold" onClick={() => handleDelete(p.id)}>Delete</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={products.total} perPage={15} onChange={setPage} />

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}

