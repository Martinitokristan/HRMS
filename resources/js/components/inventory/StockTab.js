import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import Modal from '../shared/Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function StockTab() {
    const { showToast } = useToast();
    const [inventory, setInventory] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    // Variant filters
    const [sizeFilter, setSizeFilter] = useState('');
    const [colorFilter, setColorFilter] = useState('');
    const [weightFilter, setWeightFilter] = useState('');
    const [variantMeta, setVariantMeta] = useState({ sizes: [], colors: [], weights: [] });

    const [unitTypes, setUnitTypes] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [transferModal, setTransferModal] = useState({ show: false, item: null, qty: '1' });
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferForm, setTransferForm] = useState({ name: '', sku: '', category_id: '', unit_type_id: '', sell_price: '', description: '' });

    useEffect(() => {
        axios.get('/settings').then(res => {
            setCategories(res.data.data?.categories || []);
            setUnitTypes(res.data.data?.unitTypes || []);
        }).catch(() => {});
        axios.get('/suppliers').then(res => {
            setSuppliers(res.data.data || []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchStock = () => {
            if (!isMounted) return;
            setLoading(true);
            const params = { page, search };
            if (categoryFilter) params.category_id = categoryFilter;
            if (sizeFilter) params.size = sizeFilter;
            if (colorFilter) params.color = colorFilter;
            if (weightFilter) params.weight = weightFilter;
            axios.get('/inventory', { params })
                .then(res => {
                    const paginated = res.data.data;
                    if (isMounted) {
                        setInventory({
                            data: paginated.data || [],
                            total: paginated.total || 0,
                            current_page: paginated.current_page || 1
                        });
                        if (res.data.variant_meta) {
                            setVariantMeta(res.data.variant_meta);
                        }
                    }
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        };
        const debounce = setTimeout(fetchStock, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, categoryFilter, sizeFilter, colorFilter, weightFilter, refreshTrigger]);

    const handleTransfer = async () => {
        const qty = Number(transferModal.qty);
        const available = Number(transferModal.item.warehouse_stock);

        if (!transferModal.item || isNaN(qty) || qty < 1 || qty > available) {
            showToast('Invalid transfer quantity', 'error');
            return;
        }

        setTransferLoading(true);
        try {
            const isOrphan = !transferModal.item.product_id && !transferModal.item.is_variant;
            await axios.post('/inventory/transfer', {
                inventory_id: transferModal.item.raw_id,
                quantity: qty,
                product_data: isOrphan ? transferForm : null
            });
            showToast('Stock transferred to storefront successfully!');
            setTransferModal({ show: false, item: null, qty: '1' });
            triggerRefresh();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to transfer stock', 'error');
        } finally {
            setTransferLoading(false);
        }
    };

    const openTransferModal = (item) => {
        const isOrphan = !item.product_id && !item.is_variant;
        if (isOrphan) {
            setTransferForm({
                name: (item.name || '').replace(' (Warehouse Only)', ''),
                sku: item.sku || '',
                category_id: item.category_id || '',
                unit_type_id: item.unit_type_id || 1,
                sell_price: (item.purchase_price || 0) * 1.2,
                description: item.description || ''
            });
        }
        setTransferModal({ show: true, item, qty: '1' });
    };

    const formatNum = (num) => Number(num || 0).toLocaleString();

    return (
        <div>
            <FilterBar 
                search={search} onSearchChange={v => { setSearch(v); setPage(1); }}
                filters={[
                    {
                        value: categoryFilter, onChange: v => { setCategoryFilter(v); setPage(1); },
                        options: [
                            { value: '', label: 'All Categories' },
                            ...categories.map(c => ({ value: c.id, label: c.name }))
                        ]
                    },
                    ...(variantMeta.sizes?.length > 0 ? [{
                        value: sizeFilter, onChange: v => { setSizeFilter(v); setPage(1); },
                        options: [
                            { value: '', label: 'All Sizes' },
                            ...variantMeta.sizes.map(s => ({ value: s, label: s }))
                        ]
                    }] : []),
                    ...(variantMeta.colors?.length > 0 ? [{
                        value: colorFilter, onChange: v => { setColorFilter(v); setPage(1); },
                        options: [
                            { value: '', label: 'All Colors' },
                            ...variantMeta.colors.map(c => ({ value: c, label: c }))
                        ]
                    }] : []),
                    ...(variantMeta.weights?.length > 0 ? [{
                        value: weightFilter, onChange: v => { setWeightFilter(v); setPage(1); },
                        options: [
                            { value: '', label: 'All Weights' },
                            ...variantMeta.weights.map(w => ({ value: w, label: w }))
                        ]
                    }] : []),
                ]}
            />

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">SKU</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Product Name</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Variant</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Warehouse</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Storefront</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Sold</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Imported</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Unit</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Threshold</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Status</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={11} className="text-center py-10"><div className="spinner mx-auto" /></TableCell></TableRow>
                        ) : inventory.data.length === 0 ? (
                            <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">No inventory found</TableCell></TableRow>
                        ) : inventory.data.map(item => {
                            const isLow = item.current_stock <= item.reorder_threshold;
                            const variantParts = [];
                            if (item.size && item.size !== '-') variantParts.push(item.size);
                            if (item.color && item.color !== '-') variantParts.push(item.color);
                            if (item.weight && item.weight !== '-') variantParts.push(item.weight);
                            const variantLabel = item.is_variant ? (variantParts.join(' / ') || '-') : 'Base Product';

                            return (
                                <TableRow key={item.id}>
                                    <TableCell className="px-4 py-3 text-center text-[13px] font-semibold text-foreground">{item.sku}</TableCell>
                                    <TableCell className="px-4 py-3">
                                        <div className="font-semibold text-foreground">{item.name}</div>
                                        <div className="text-[12px] text-muted-foreground">{item.supplier}</div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center text-muted-foreground">{variantLabel}</TableCell>
                                    <TableCell className="px-4 py-3 text-center font-bold text-primary">{formatNum(item.warehouse_stock)}</TableCell>
                                    <TableCell className="px-4 py-3 text-center font-bold text-[15px] text-foreground">{formatNum(item.current_stock)}</TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <span className={`font-semibold ${item.total_sold > 0 ? 'text-success-foreground' : 'text-muted-foreground'}`}>
                                            {formatNum(item.total_sold)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <span className={`font-semibold ${item.total_imported > 0 ? 'text-info' : 'text-muted-foreground'}`}>
                                            {formatNum(item.total_imported)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center text-muted-foreground">{item.unit}</TableCell>
                                    <TableCell className="px-4 py-3 text-center font-semibold">{formatNum(item.reorder_threshold)}</TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        {isLow
                                            ? <Badge variant="outline" className="border-destructive/30 bg-danger-light text-destructive">Low Stock</Badge>
                                            : <Badge variant="outline" className="border-success/30 bg-success-light text-success-foreground">Optimal</Badge>}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        {item.warehouse_stock > 0 && (
                                            <Button size="sm" onClick={() => openTransferModal(item)}>
                                                Transfer
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={inventory.total} perPage={15} onChange={setPage} />

            <Modal 
                isOpen={transferModal.show} 
                onClose={() => setTransferModal({ show: false, item: null, qty: '1' })} 
                title="Transfer to Storefront"
                size="lg"
            >
                {transferModal.item && (
                    <div className="space-y-6">
                        {/* Header Info */}
                        <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Moving stock for <strong className="text-primary">{transferModal.item.name}</strong> 
                                {transferModal.item.is_variant ? ` (${transferModal.item.size}/${transferModal.item.color})` : ''} 
                                from Warehouse to Storefront.
                            </p>
                        </div>
                        
                        {/* Stock and Transfer Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="bg-secondary/50 p-5">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Available in Warehouse</Label>
                                <div className="text-2xl font-bold text-foreground mt-2">{formatNum(transferModal.item.warehouse_stock)} <span className="text-sm font-medium text-muted-foreground">{transferModal.item.unit}</span></div>
                            </Card>

                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantity to Transfer</Label>
                                <Input 
                                    type="number" 
                                    className="h-14 text-xl font-bold text-center"
                                    min="1" 
                                    max={transferModal.item.warehouse_stock}
                                    value={transferModal.qty}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setTransferModal({ ...transferModal, qty: '' });
                                        } else {
                                            const num = parseInt(val);
                                            setTransferModal({ ...transferModal, qty: isNaN(num) ? '1' : num.toString() });
                                        }
                                    }}
                                    onBlur={() => {
                                        if (transferModal.qty === '' || parseInt(transferModal.qty) < 1) {
                                            setTransferModal({ ...transferModal, qty: '1' });
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Product Setup Form */}
                        {(!transferModal.item.product_id && !transferModal.item.is_variant) && (
                            <Card className="bg-secondary/30 p-6 space-y-4">
                                <h4 className="text-base font-bold text-foreground pb-3 border-b border-border">Setup Storefront Product Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Store Name</Label>
                                        <Input value={transferForm.name} onChange={e => setTransferForm({...transferForm, name: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>SKU</Label>
                                        <Input value={transferForm.sku} onChange={e => setTransferForm({...transferForm, sku: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={transferForm.category_id}
                                            onChange={e => setTransferForm({...transferForm, category_id: e.target.value})}>
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Unit Type</Label>
                                        <select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={transferForm.unit_type_id}
                                            onChange={e => setTransferForm({...transferForm, unit_type_id: e.target.value})}>
                                            <option value="">Select Unit</option>
                                            {unitTypes.map(u => <option key={u.id} value={u.id}>{u.purchase_unit} / {u.sell_unit}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Selling Price (₱)</Label>
                                        <Input type="number" step="0.01" value={transferForm.sell_price} onChange={e => setTransferForm({...transferForm, sell_price: e.target.value})} />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <Label>Description</Label>
                                        <Textarea rows={3} value={transferForm.description} onChange={e => setTransferForm({...transferForm, description: e.target.value})} />
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-4 pt-4">
                            <Button 
                                variant="outline"
                                className="flex-1 h-12 font-semibold"
                                onClick={() => setTransferModal({ show: false, item: null, qty: '1' })}
                                disabled={transferLoading}
                            >
                                Cancel
                            </Button>
                            <Button 
                                className="flex-1 h-12 font-semibold"
                                onClick={handleTransfer}
                                disabled={transferLoading || !transferModal.qty}
                            >
                                {transferLoading ? 'Transferring...' : 'Confirm Transfer'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
