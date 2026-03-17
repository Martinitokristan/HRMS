import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import ConfirmModal from '../shared/ConfirmModal';
import ProductForm from './ProductForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function Products() {
    const [products, setProducts] = useState({ data: [], total: 0, current_page: 1 });
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [unitTypes, setUnitTypes] = useState([]);
    const [allVariants, setAllVariants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);
    
    // Filters & Pagination
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    
    // View: 'list' | 'form'
    const [view, setView] = useState('list');
    const [editingProduct, setEditingProduct] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const { showToast } = useToast();

    const openCreate = () => { setEditingProduct(null); setView('form'); };
    const openEdit   = (p) => { setEditingProduct(p);    setView('form'); };
    const closeForm  = () => { setEditingProduct(null); setView('list'); };

    useEffect(() => {
        let isMounted = true;
        const fetchDependencies = async () => {
            try {
                const [cats, sups, units, settingsData] = await Promise.all([
                    axios.get('/categories'),
                    axios.get('/suppliers', { params: { no_pagination: 1 } }),
                    axios.get('/unit-types'),
                    axios.get('/settings')
                ]);
                if (isMounted) {
                    setCategories(cats.data.data);
                    setSuppliers(sups.data.data);
                    setUnitTypes(units.data.data);
                    setAllVariants(settingsData.data.data.variants || []);
                }
            } catch (err) {}
        };
        fetchDependencies();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchProds = () => {
            if (!isMounted) return;
            setLoading(true);
            axios.get('/products', { params: { page, search, category_id: categoryFilter } })
                .then(res => {
                    const paginated = res.data.data;
                    if (isMounted) {
                        setProducts({
                            data: paginated.data || [],
                            total: paginated.total || 0,
                            current_page: paginated.current_page || 1
                        });
                    }
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        };
        const debounce = setTimeout(fetchProds, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, categoryFilter, refreshTrigger]);

    const handleEdit = (product) => openEdit(product);

    const handleDelete = async () => {
        try {
            await axios.delete(`/products/${deleteId}`);
            if (showToast) showToast('Product deleted successfully');
            triggerRefresh();
        } catch (err) {
            showToast('Failed to delete product', 'error');
        } finally {
            setDeleteId(null);
        }
    };

    // If form view, render ProductForm filling the content area
    if (view === 'form') {
        return (
            <ProductForm
                product={editingProduct}
                categories={categories}
                suppliers={suppliers}
                unitTypes={unitTypes}
                variants={allVariants}
                onSuccess={() => { closeForm(); triggerRefresh(); }}
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
                            ...categories.map(c => ({ value: c.id, label: c.name }))
                        ]
                    }
                ]}
            />

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">SKU / Image</TableHead>
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
                        ) : products.data.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No products found.</TableCell></TableRow>
                        ) : products.data.map(p => {
                            const margin = p.sell_price > 0 ? ((p.sell_price - p.purchase_price) / p.sell_price * 100).toFixed(1) : 0;
                            return (
                                <TableRow key={p.id}>
                                    <TableCell className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {(() => {
                                                const firstImg = p.product_variants?.find(v => v.image_path)?.image_path;
                                                return firstImg
                                                    ? <img src={`/storage/${firstImg}`} alt={p.name} className="h-10 w-10 rounded-lg object-cover border border-border" />
                                                    : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-lg">📦</div>;
                                            })()}
                                            <span className="text-[13px] font-semibold text-foreground">{p.sku}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="font-semibold text-foreground">{p.name}</div>
                                        <div className="text-[12px] text-muted-foreground">{p.supplier?.name}</div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Badge variant="secondary">{p.category?.name}</Badge>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-right text-muted-foreground font-medium">₱{Number(p.purchase_price).toFixed(2)}</TableCell>
                                    <TableCell className="px-4 py-3 text-right font-bold text-primary">₱{Number(p.sell_price).toFixed(2)}</TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <Badge variant="outline" className={margin > 20 ? 'border-success/30 bg-success-light text-success-foreground' : 'border-warning/30 bg-warning-light text-warning-foreground'}>
                                            {margin}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <div className="font-semibold text-foreground">
                                            {p.product_variants?.length > 0 ? (
                                                <>
                                                    {p.product_variants.reduce((sum, v) => sum + (v.stock || 0), 0)} pcs 
                                                    <div className="text-[11px] text-muted-foreground">({p.product_variants.length} variants)</div>
                                                </>
                                            ) : (
                                                `${p.inventory?.current_stock || 0} pcs`
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                                            <Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={products.total} perPage={15} onChange={setPage} />

            <ConfirmModal 
                isOpen={!!deleteId}
                onCancel={() => setDeleteId(null)}
                onConfirm={handleDelete}
                message="Are you sure you want to delete this product? This action cannot be undone."
            />
        </div>
    );
}
