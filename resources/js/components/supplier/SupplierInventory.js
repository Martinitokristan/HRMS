import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Pencil, Trash2, Plus } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { STALE_KEYS, markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';
import Tooltip from '../shared/Tooltip';
import ProductForm from './ProductForm';

export default function SupplierInventory() {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.SUPPLIER_DASHBOARD);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isAdding, setIsAdding] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        show: false, title: '', message: '',
        onConfirm: null, variant: 'default'
    });
    const closeConfirm = () => setConfirmModal({ show: false, title: '', message: '', onConfirm: null, variant: 'default' });

    const fetchInventory = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/supplier/products?per_page=100');
            setProducts(res.data?.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch inventory', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory(products.length > 0);
    }, [refreshTrigger]);

    const handleDelete = (product) => {
        setConfirmModal({
            show: true,
            title: 'Delete Product',
            message: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
            onConfirm: async () => {
                closeConfirm();
                try {
                    await api.delete(`/supplier/products/${product.id}`);
                    markStale(STALE_KEYS.SUPPLIER_PRODUCTS, STALE_KEYS.ADMIN_INVENTORY, STALE_KEYS.CUSTOMER_SHOP);
                    fetchInventory(true);
                } catch (err) {
                    console.error('Failed to delete product', err);
                    alert('Failed to delete product.');
                }
            },
            variant: 'destructive'
        });
    };

    if (isAdding || editingProduct) {
        return (
            <ProductForm 
                editing={editingProduct} 
                onClose={() => { setEditingProduct(null); setIsAdding(false); }} 
                onSuccess={() => fetchInventory(true)}
            />
        );
    }

    if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

    return (
        <div className="space-y-6 max-w-full">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Product Inventory</h1>
                    <p className="text-sm text-muted-foreground mt-1">View product details and manage your catalog</p>
                </div>
                <Button onClick={() => setIsAdding(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add New Product
                </Button>
            </div>

            <Card className="overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
                    <h3 className="font-bold text-foreground text-base">Product Inventory Management</h3>
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/supplier/products">View as Catalog</Link>
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-5 py-3 w-16">Image</th>
                                <th className="px-5 py-3">Product Name</th>
                                <th className="px-5 py-3">Barcode</th>
                                <th className="px-5 py-3">Brand</th>
                                <th className="px-5 py-3">Category</th>
                                <th className="px-5 py-3 text-right">Price</th>
                                <th className="px-5 py-3 text-center">Current Stock</th>
                                <th className="px-5 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-5 py-8 text-center text-muted-foreground">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        No products found.
                                    </td>
                                </tr>
                            ) : (
                                products.map((p) => {
                                    const stock = Number(p.total_stock) || 0;
                                    const isLow = stock <= (Number(p.min_order_qty) || 10);

                                    return (
                                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="h-10 w-10 rounded border border-border bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                                                    {p.image_path ? (
                                                        <img src={`/storage/${p.image_path}`} alt={p.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Package className="h-5 w-5 text-muted-foreground opacity-30" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 font-semibold text-foreground">{p.name}</td>
                                            <td className="px-5 py-3 font-mono text-xs">{p.barcode || '-'}</td>
                                            <td className="px-5 py-3 text-xs">{p.brand_name || p.brand?.name || <span className="text-muted-foreground italic">No Brand</span>}</td>
                                            <td className="px-5 py-3">
                                                <Badge variant="outline" className="text-[10px] font-semibold">
                                                    {p.category_name || p.category?.name || 'Uncategorized'}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-3 text-right font-medium">₱{Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`font-bold text-sm ${isLow ? 'text-red-500' : 'text-foreground'}`}>
                                                    {stock}
                                                </span>
                                                {isLow && (
                                                    <Badge variant="outline" className="ml-2 text-[8px] h-4 px-1.5 font-bold uppercase bg-red-50 text-red-600 border-red-200">
                                                        Low
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Tooltip label="Edit Product" position="top">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setEditingProduct(p)}
                                                            className="h-8 w-8 p-0 flex items-center justify-center transition-all hover:scale-110 active:scale-95 text-muted-foreground hover:text-primary hover:border-primary/30"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip label="Delete Product" position="top">
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDelete(p)}
                                                            className="h-8 w-8 p-0 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm shadow-red-200"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </Tooltip>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
