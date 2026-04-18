import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Database } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { STALE_KEYS } from '../../store/dataStore';

export default function SupplierProducts() {
    const navigate = useNavigate();
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.SUPPLIER_PRODUCTS);
    const [products, setProducts] = useState({ data: [], total: 0 });
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => { 
        fetchProducts(); 
    }, [page, search, categoryFilter, refreshTrigger]);
    
    useEffect(() => { 
        fetchCategories(); 
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/supplier/categories');
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            setCategories(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = { page, per_page: 12 };
            if (search) params.search = search;
            if (categoryFilter) params.category_id = categoryFilter;
            const res = await api.get('/supplier/products', { params });
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                setProducts({
                    data: Array.isArray(data.data) ? data.data : [],
                    total: data.total || 0
                });
            } else if (Array.isArray(data)) {
                setProducts({ data: data, total: data.length });
            } else {
                setProducts({ data: [], total: 0 });
            }
        } catch (e) {
            console.error('Failed to fetch supplier products:', e);
            setProducts({ data: [], total: 0 });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-foreground">Product Catalog</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">View your published products</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/supplier/inventory')}>
                        <Database className="h-4 w-4 mr-2" /> Manage Inventory
                    </Button>
                    <Button onClick={() => navigate('/supplier/inventory')}>
                        <Plus className="h-4 w-4 mr-2" /> Add Product
                    </Button>
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
                    <p className="text-muted-foreground mb-6">Manage your stock and add products in the Inventory module.</p>
                    <Button onClick={() => navigate('/supplier/inventory')}><Plus className="h-4 w-4 mr-1" /> Add Your First Product</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {products.data.map(p => {
                        const imgSrc = p.image_path ? `/storage/${p.image_path}` : null;
                        const hasVariants = (p.variants?.length || 0) > 0;
                        
                        return (
                            <Card 
                                key={p.id} 
                                className="group overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-2 border-transparent hover:border-primary/20"
                                onClick={() => navigate('/supplier/inventory')}
                            >
                                {/* Product Image */}
                                <div className="relative aspect-square bg-gradient-to-br from-secondary to-secondary/50 overflow-hidden">
                                    {imgSrc ? (
                                        <img 
                                            src={imgSrc} 
                                            alt={p.name} 
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Package className="h-16 w-16 text-muted-foreground opacity-20" />
                                        </div>
                                    )}
                                    
                                    {p.is_promoted && (
                                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-white text-center py-1.5 text-[10px] font-extrabold tracking-widest uppercase">
                                            ⭐ Featured
                                        </div>
                                    )}
                                </div>

                                {/* Product Info */}
                                <div className="p-4 bg-white">
                                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary mb-1.5">
                                        {p.category?.name || 'Uncategorized'}
                                    </div>
                                    <h3 className="font-bold text-foreground text-sm leading-tight mb-2 line-clamp-2 min-h-[2.5rem]">
                                        {p.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge variant={p.total_stock > 0 ? "default" : "destructive"} className="text-[10px] font-bold">
                                            📦 {p.total_stock || 0} stock
                                        </Badge>
                                    </div>
                                    <div className="pt-3 border-t border-border/50">
                                        <div className="text-xl font-black text-foreground">
                                            ₱{Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Pagination page={page} total={products.total} perPage={12} onChange={setPage} />
        </div>
    );
}
