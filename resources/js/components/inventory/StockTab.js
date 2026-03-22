import React, { useState, useEffect, useMemo } from 'react';
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
    const [transferModal, setTransferModal] = useState({ show: false, item: null, qty: '1', allVariants: [] });
    const [transferForm, setTransferForm] = useState({ name: '', barcode: '', category_id: '', unit_type_id: 1, sell_price: '', description: '', purchase_price: 0 });
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);
    const [expandedProducts, setExpandedProducts] = useState(new Set());

    // Memoize grouped inventory data to prevent unnecessary recalculations
    const groupedInventory = useMemo(() => {
        if (!inventory.data || inventory.data.length === 0) return [];
        
        const grouped = [];
        const productMap = new Map();
        const processedIds = new Set();

        inventory.data.forEach(item => {
            if (processedIds.has(item.id)) return;

            if (item.product_id && !item.is_orphan) {
                const productKey = item.product_id;

                if (item.is_variant) {
                    // Variant row — ensure base exists in map first
                    if (!productMap.has(productKey)) {
                        // Look for the explicit base row (is_base_of_variants)
                        const baseRow = inventory.data.find(i =>
                            i.product_id === productKey && 
                            !i.is_variant && 
                            (i.is_base_of_variants === true || (!i.is_orphan && !i.is_variant))
                        );
                        
                        // Create base product entry with proper stock
                        const baseEntry = {
                            ...(baseRow || item),
                            id: baseRow ? baseRow.id : `base-${productKey}`,
                            product_id: productKey,
                            is_variant: false,
                            is_orphan: false,
                            hasVariants: true,
                            variants: [],
                            // IMPORTANT: Use baseRow stock if available, otherwise 0 (not variant stock)
                            warehouse_stock: baseRow ? (baseRow.warehouse_stock || 0) : 0,
                            current_stock: baseRow ? (baseRow.current_stock || 0) : 0,
                            raw_id: baseRow ? baseRow.raw_id : null,
                        };
                        
                        productMap.set(productKey, baseEntry);
                        if (baseRow) processedIds.add(baseRow.id);
                    }
                    productMap.get(productKey).variants.push(item);
                    processedIds.add(item.id);

                } else {
                    // Base row (is_base_of_variants or standalone)
                    const relatedVariants = inventory.data.filter(
                        i => i.is_variant && i.product_id === productKey && !i.is_orphan
                    );
                    
                    // Check if this item is marked as base of variants by backend
                    const isBaseOfVariants = item.is_base_of_variants === true;
                    
                    if (!productMap.has(productKey)) {
                        productMap.set(productKey, {
                            ...item,
                            hasVariants: relatedVariants.length > 0 || isBaseOfVariants,
                            variants: relatedVariants,
                            // Keep base's own warehouse_stock — table will aggregate variants separately
                            warehouse_stock: item.warehouse_stock || 0,
                        });
                        processedIds.add(item.id);
                        relatedVariants.forEach(v => processedIds.add(v.id));
                    }
                }

            } else if (item.is_orphan) {
                const nameKey = item.name.trim().toLowerCase();
                const relatedOrphans = inventory.data.filter(
                    i => i.is_orphan && i.name.trim().toLowerCase() === nameKey
                );
                if (!productMap.has(`name-${nameKey}`)) {
                    // Separate base and variants
                    const baseOrphan = relatedOrphans.find(i => !i.is_variant);
                    const variantOrphans = relatedOrphans.filter(i => i.is_variant);
                    
                    productMap.set(`name-${nameKey}`, {
                        ...baseOrphan,
                        id: `name-base-${nameKey}`,
                        is_variant: false,
                        is_orphan: true,
                        hasVariants: variantOrphans.length > 0,
                        variants: variantOrphans,
                        // Base should only include its own stock, not variants
                        warehouse_stock: baseOrphan ? Number(baseOrphan.warehouse_stock || 0) : 0,
                        current_stock: baseOrphan ? Number(baseOrphan.current_stock || 0) : 0,
                        total_sold: relatedOrphans.reduce((s, i) => s + Number(i.total_sold || 0), 0),
                        total_imported: relatedOrphans.reduce((s, i) => s + Number(i.total_imported || 0), 0),
                    });
                    relatedOrphans.forEach(i => processedIds.add(i.id));
                }

            } else {
                grouped.push({ ...item, variants: [], hasVariants: false });
                processedIds.add(item.id);
            }
        });

        productMap.forEach(product => grouped.push(product));
        return grouped;
    }, [inventory.data]);

    const toggleExpand = (productId) => {
        setExpandedProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };

    useEffect(() => {
        console.log('🔍 [StockTab] Loading initial settings and suppliers...');
        axios.get('/settings').then(res => {
            console.log('✅ [StockTab] Settings response:', res);
            console.log('✅ [StockTab] Settings data structure:', res.data);
            setCategories(res.data?.data?.categories || []);
            setUnitTypes(res.data?.data?.unitTypes || []);
        }).catch(err => {
            console.error('❌ [StockTab] Settings error:', err);
        });
        axios.get('/suppliers').then(res => {
            console.log('✅ [StockTab] Suppliers response:', res);
            console.log('✅ [StockTab] Suppliers data structure:', res.data);
            setSuppliers(res.data?.data || res.data || []);
        }).catch(err => {
            console.error('❌ [StockTab] Suppliers error:', err);
        });
    }, []);

    useEffect(() => {
        let isMounted = true;
        let debounce;

        const fetch = async () => {
            setLoading(true);
            const params = { page, search };
            if (categoryFilter) params.category_id = categoryFilter;
            if (sizeFilter) params.size = sizeFilter;
            if (colorFilter) params.color = colorFilter;
            if (weightFilter) params.weight = weightFilter;
            // Add cache-busting timestamp to force fresh data
            params._t = Date.now();
            axios.get('/inventory', { params })
                .then(res => {
                    console.log('✅ [StockTab] Inventory response:', res);
                    console.log('✅ [StockTab] Inventory data structure:', res.data);
                    const paginated = res.data?.data || {};
                    if (isMounted) {
                        // Store raw data - grouping is handled by useMemo
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

        // Debounce search to reduce API calls (500ms for better performance)
        debounce = setTimeout(fetch, 500);

        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, categoryFilter, sizeFilter, colorFilter, weightFilter, refreshTrigger]);

    const handleTransfer = async () => {
        const qty = parseFloat(transferModal.qty);
        const available = parseFloat(transferModal.item.warehouse_stock);

        if (!transferModal.item || isNaN(qty) || qty < 1 || qty > available) {
            showToast('Invalid transfer quantity', 'error');
            return;
        }

        if (!transferForm.unit_type_id) {
            showToast('Please select a unit type', 'error');
            return;
        }

        if (!transferForm.sell_price || parseFloat(transferForm.sell_price) <= 0) {
            showToast('Please enter a valid retail price', 'error');
            return;
        }

        setTransferLoading(true);
        try {
            // Always send product_data so admin edits (name, price, unit, category) are applied
            await axios.post('/inventory/transfer', {
                inventory_id: transferModal.item.raw_id,
                quantity: qty,
                product_data: {
                    name: transferForm.name,
                    barcode: transferForm.barcode,
                    category_id: transferForm.category_id,
                    unit_type_id: transferForm.unit_type_id,
                    sell_price: parseFloat(transferForm.sell_price),
                    description: transferForm.description,
                    purchase_price: transferForm.purchase_price,
                },
            });
            showToast('Stock transferred to storefront successfully!');
            setTransferModal({ show: false, item: null, qty: '1', allVariants: [] });
            setSelectedVariantId('');
            triggerRefresh(); // Refresh and clear expanded set to ensure data is updated accurately
            setExpandedProducts(new Set());
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to transfer stock', 'error');
        } finally {
            setTransferLoading(false);
        }
    };

    const openTransferModal = async (item) => {
        // Ensure categories and unit types are loaded
        if (categories.length === 0 || unitTypes.length === 0) {
            try {
                const [categoriesRes, unitTypesRes] = await Promise.all([
                    axios.get('/categories'),
                    axios.get('/settings/unit-types')
                ]);
                
                const fetchedCategories = categoriesRes.data?.data || [];
                const fetchedUnitTypes = unitTypesRes.data?.data || [];
                
                // Wait for state to update
                await new Promise(resolve => {
                    setCategories(fetchedCategories);
                    setUnitTypes(fetchedUnitTypes);
                    setTimeout(resolve, 100); // Small delay for state update
                });
            } catch (err) {
                console.error('Failed to load categories/unit types:', err);
            }
        }
        
        // For variants, ensure we inherit category and unit from parent product
        let category_id = item.category_id || '';
        let unit_type_id = item.unit_type_id || 1;
        
        // If this is a variant and missing category/unit, fetch from parent product
        if (item.is_variant && item.product_id && (!category_id || !unit_type_id)) {
            try {
                // Use relative path for internal API call
                const productRes = await axios.get(`/products/${item.product_id}`);
                console.log('✅ [StockTab] Transfer - product API response:', productRes);
                const product = productRes.data?.data || productRes.data || {};
                
                if (!category_id) category_id = product.category_id || '';
                if (!unit_type_id) unit_type_id = product.unit_type_id || 1;
            } catch (err) {
                console.error('❌ [StockTab] Transfer - Failed to fetch parent product for variant:', err);
            }
        }
        
        // Always allow admin to edit product details for retail markup
        setTransferForm({
            name: (item.name || '').replace(' (Warehouse Only)', ''),
            barcode: item.barcode || '',
            category_id: category_id,
            unit_type_id: unit_type_id,
            sell_price: item.sell_price || parseFloat(((item.purchase_price || 0) * 1.3).toFixed(2)), // 30% markup default
            description: item.description || '',
            purchase_price: item.purchase_price || 0,
        });

        let allVariants = [];

        if (item.product_id && !item.is_variant) {
            // Case 1: Already-tracked product with local product_id — fetch storefront variants
            try {
                const res = await axios.get(`/inventory?product_id=${item.product_id}`);
                console.log('✅ [StockTab] Transfer - inventory fetch response:', res);
                console.log('✅ [StockTab] Transfer - inventory data structure:', res.data);
                const inventoryData = res.data?.data?.data || res.data?.data || [];
                allVariants = inventoryData.filter(inv => 
                    inv.product_id === item.product_id && 
                    inv.is_variant && 
                    inv.warehouse_stock > 0
                );
            } catch (err) {
                console.error('❌ [StockTab] Transfer - Failed to fetch variants:', err);
            }
        } else if (item.is_orphan && item.supplier_product_id) {
            // Case 2: Warehouse-Only orphan — fetch supplier product variants via API
            try {
                // Ensure categories are loaded
                let fetchedCategories = categories;
                let fetchedUnitTypes = unitTypes;
                
                if (categories.length === 0) {
                    // Fetch categories from /categories API
                    const [categoriesRes, unitTypesRes] = await Promise.all([
                        axios.get('/categories'),
                        axios.get('/settings/unit-types')
                    ]);
                    
                    fetchedCategories = categoriesRes.data?.data || [];
                    fetchedUnitTypes = unitTypesRes.data?.data || [];
                    
                    setCategories(fetchedCategories);
                    setUnitTypes(fetchedUnitTypes);
                }
                
                const res = await axios.get(`/supplier-catalog/${item.supplier_product_id}`);
                console.log('✅ [StockTab] Transfer - supplier catalog response:', res);
                console.log('✅ [StockTab] Transfer - supplier catalog data structure:', res.data);
                const supplierProduct = res.data?.data || res.data || {};
                const spVariants = supplierProduct?.variants || [];
                
                // Use supplier product data for transfer form
                setTransferForm({
                    name: supplierProduct?.name || (item.name || '').replace(' (Warehouse Only)', ''),
                    barcode: supplierProduct?.barcode || item.barcode || '',
                    category_id: supplierProduct?.category_id || item.category_id || '',
                    unit_type_id: supplierProduct?.unit_type_id || item.unit_type_id || 1,
                    sell_price: parseFloat(((supplierProduct?.price || item.purchase_price || 0) * 1.3).toFixed(2)), // 30% markup default
                    description: supplierProduct?.description || item.description || '',
                    purchase_price: supplierProduct?.price || item.purchase_price || 0,
                });
                
                allVariants = spVariants
                    .filter(v => (v.stock || 0) > 0)
                    .map(v => ({
                        raw_id: `spv-${v.id}`,           // prefix so the transfer logic knows it's a supplier variant
                        supplier_variant_id: v.id,
                        size: v.size || '',
                        color: v.color || '',
                        weight: v.weight || '',
                        warehouse_stock: v.stock || 0,
                        purchase_price: v.price_override || supplierProduct?.price || 0,
                    }));
            } catch (err) {
                console.error('Failed to fetch supplier variants:', err);
                console.error('Error details:', err.response?.data || err.message);
            }
        }

        setTransferModal({ show: true, item, qty: '1', allVariants });
        setSelectedVariantId('');
    };

    const formatNum = (num) => Math.round(Number(num || 0)).toLocaleString();

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
                ]}
            />

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4 text-center">Barcode</TableHead>
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
                        ) : groupedInventory.length === 0 ? (
                            <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">No inventory found</TableCell></TableRow>
                        ) : groupedInventory.map(item => {
                            const isExpanded = expandedProducts.has(item.product_id || item.id);
                            const hasVariants = item.hasVariants && item.variants && item.variants.length > 0;

                            // Base's OWN stock (what the Transfer button acts on)
                            const baseWarehouse = Number(item.warehouse_stock || 0);
                            const baseStorefront = Number(item.current_stock || 0);

                            // Aggregated totals for display in the summary row
                            const variantWarehouse = hasVariants ? item.variants.reduce((s, v) => s + Number(v.warehouse_stock || 0), 0) : 0;
                            const variantStorefront = hasVariants ? item.variants.reduce((s, v) => s + Number(v.current_stock || 0), 0) : 0;
                            const totalSold = (hasVariants
                                ? item.variants.reduce((s, v) => s + Number(v.total_sold || 0), 0)
                                : 0) + Number(item.total_sold || 0);
                            const totalImported = (hasVariants
                                ? item.variants.reduce((s, v) => s + Number(v.total_imported || 0), 0)
                                : 0) + Number(item.total_imported || 0);

                            // For the warehouse column: show ONLY base own stock (variants shown separately)
                            const displayWarehouse = baseWarehouse;
                            // For storefront: show ONLY base stock (variants shown separately)
                            const displayStorefront = baseStorefront;

                            const isLow = hasVariants
                                ? item.variants.some(v => Number(v.current_stock || 0) <= Number(v.reorder_threshold || 10))
                                : Number(item.current_stock || 0) <= Number(item.reorder_threshold || 10);

                            return (
                                <React.Fragment key={item.id}>
                                    {/* Base Product Row */}
                                    <TableRow className={hasVariants ? 'cursor-pointer hover:bg-secondary/30' : ''}>
                                        <TableCell className="px-4 py-3 text-center text-[13px] font-semibold text-foreground">{item.barcode}</TableCell>
                                        <TableCell className="px-4 py-3" onClick={() => hasVariants && toggleExpand(item.product_id || item.id)}>
                                            <div className="flex items-center gap-2">
                                                {hasVariants && (
                                                    <span className="text-orange-500 font-bold text-lg mr-2">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </span>
                                                )}
                                                <div>
                                                    <div className="font-semibold text-foreground">{item.name}</div>
                                                    <div className="text-[12px] text-muted-foreground">{item.supplier}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center text-muted-foreground">
                                            {hasVariants ? (
                                                <Badge variant="secondary" className="font-semibold">{item.variants.length} Variant{item.variants.length !== 1 ? 's' : ''}</Badge>
                                            ) : item.is_orphan && item.supplier_variant_count > 0 ? (
                                                `Base (${item.supplier_variant_count} variants)`
                                            ) : (
                                                'Base Product'
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center font-bold text-primary">
                                            {formatNum(displayWarehouse)}
                                            {hasVariants && baseWarehouse > 0 && (
                                                <div className="text-[10px] text-muted-foreground font-normal">base: {formatNum(baseWarehouse)}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center font-bold text-[15px] text-foreground">{formatNum(displayStorefront)}</TableCell>
                                        <TableCell className="px-4 py-3 text-center">
                                            <span className={`font-semibold ${totalSold > 0 ? 'text-success-foreground' : 'text-muted-foreground'}`}>
                                                {formatNum(totalSold)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center">
                                            <span className={`font-semibold ${totalImported > 0 ? 'text-info' : 'text-muted-foreground'}`}>
                                                {formatNum(totalImported)}
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
                                            {/* Base Transfer: only shown when the base product itself has warehouse stock */}
                                            {baseWarehouse > 0 && (
                                                <Button size="sm" onClick={() => openTransferModal(item)}>
                                                    Transfer
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>

                                    {/* Variant Rows (Expandable) */}
                                    {hasVariants && isExpanded && item.variants.map(variant => {
                                        const variantParts = [];
                                        if (variant.size && variant.size !== '-') variantParts.push(variant.size);
                                        if (variant.color && variant.color !== '-') variantParts.push(variant.color);
                                        if (variant.weight && variant.weight !== '-') variantParts.push(variant.weight);
                
                                        const variantDetails = variantParts.join(' / ') || '';
                                        const variantFullName = variantDetails ? `${item.name} (${variantDetails})` : item.name;
                                        const variantLow = variant.current_stock <= variant.reorder_threshold;

                                        return (
                                            <TableRow key={variant.id} className="bg-secondary/10">
                                                <TableCell className="px-4 py-3 text-center text-[13px] font-semibold text-foreground">{variant.barcode}</TableCell>
                                                <TableCell className="px-4 py-3">
                                                    <div className="flex items-center gap-2 ml-6">
                                                        <div>
                                                            <div className="font-semibold text-foreground">{variantFullName}</div>
                                                            <div className="text-[12px] text-muted-foreground">{variant.supplier}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center text-muted-foreground">Variant</TableCell>
                                                <TableCell className="px-4 py-3 text-center font-bold text-primary">{formatNum(variant.warehouse_stock)}</TableCell>
                                                <TableCell className="px-4 py-3 text-center font-bold text-[15px] text-foreground">{formatNum(variant.current_stock)}</TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <span className={`font-semibold ${variant.total_sold > 0 ? 'text-success-foreground' : 'text-muted-foreground'}`}>
                                                        {formatNum(variant.total_sold)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    <span className={`font-semibold ${variant.total_imported > 0 ? 'text-info' : 'text-muted-foreground'}`}>
                                                        {formatNum(variant.total_imported)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center text-muted-foreground">{variant.unit}</TableCell>
                                                <TableCell className="px-4 py-3 text-center font-semibold">{formatNum(variant.reorder_threshold)}</TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    {variantLow
                                                        ? <Badge variant="outline" className="border-destructive/30 bg-danger-light text-destructive">Low Stock</Badge>
                                                        : <Badge variant="outline" className="border-success/30 bg-success-light text-success-foreground">Optimal</Badge>}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-center">
                                                    {variant.warehouse_stock > 0 && (
                                                        <Button size="sm" onClick={() => openTransferModal(variant)}>
                                                            Transfer
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={inventory.total} perPage={15} onChange={setPage} />

            <Modal
                isOpen={transferModal.show}
                onClose={() => setTransferModal({ show: false, item: null, qty: '1', allVariants: [] })}
                title="Transfer to Storefront"
                size="xl"
            >
                {transferModal.item && (() => {
                    const item = transferModal.item;
                    const isVariant = item.is_variant;
                    const variantParts = [];
                    if (isVariant) {
                        if (item.size && item.size !== '-') variantParts.push(item.size);
                        if (item.color && item.color !== '-') variantParts.push(item.color);
                        if (item.weight && item.weight !== '-') variantParts.push(item.weight);
                    }
                    const variantLabel = variantParts.join(' / ');
                    const profitPct = transferForm.sell_price > 0 && transferForm.purchase_price > 0
                        ? (((transferForm.sell_price - transferForm.purchase_price) / transferForm.sell_price) * 100).toFixed(1)
                        : '0';

                    return (
                        <div className="space-y-5">
                        {/* ── Item Identity Banner ── */}
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/40 border border-border">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-foreground text-base">{item.name.replace(' (Warehouse Only)', '')}</span>
                                    {isVariant && variantLabel && (
                                        <Badge variant="secondary" className="text-xs font-semibold">{variantLabel}</Badge>
                                    )}
                                    {isVariant
                                        ? <Badge className="bg-blue-100 text-blue-700 text-[10px] font-bold">Variant</Badge>
                                        : <Badge className="bg-orange-100 text-orange-700 text-[10px] font-bold">Base Product</Badge>
                                    }
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{item.supplier !== '-' ? item.supplier : ''}</div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">In Warehouse</div>
                                <div className="text-2xl font-black text-primary">{formatNum(item.warehouse_stock)}</div>
                                <div className="text-xs text-muted-foreground">{item.unit || 'units'}</div>
                            </div>
                        </div>

                        {/* ── Quantity + Pricing Row ── */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Qty to Transfer</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max={item.warehouse_stock}
                                    value={transferModal.qty}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') { setTransferModal({ ...transferModal, qty: '' }); return; }
                                        const num = parseInt(val);
                                        setTransferModal({ ...transferModal, qty: isNaN(num) ? '1' : num.toString() });
                                    }}
                                    onBlur={() => {
                                        if (!transferModal.qty || parseInt(transferModal.qty) < 1)
                                            setTransferModal({ ...transferModal, qty: '1' });
                                    }}
                                    className="h-12 text-xl font-bold text-center border-2 focus:border-primary"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] uppercase tracking-widest font-bold text-orange-600">Retail Price (₱) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={transferForm.sell_price}
                                    onChange={e => setTransferForm({ ...transferForm, sell_price: e.target.value })}
                                    className="h-12 text-xl font-bold text-center border-2 border-orange-300 focus:border-orange-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] uppercase tracking-widest font-bold text-green-700">Profit Margin</Label>
                                <div className={`h-12 flex items-center justify-center rounded-md border-2 font-black text-xl ${parseFloat(profitPct) >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                    {profitPct}%
                                </div>
                            </div>
                        </div>

                        {/* ── Purchase price info ── */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                            <span>Cost Price:</span>
                            <span className="font-bold text-gray-900">₱{Number(transferForm.purchase_price || 0).toFixed(2)}</span>
                            <span className="ml-auto text-xs text-muted-foreground">Set retail price ≥ cost to make profit</span>
                        </div>

                        {/* ── Retail Storefront Settings ── */}
                        <div className="rounded-xl border-2 border-orange-100 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 bg-orange-50 border-b border-orange-100">
                                <h4 className="font-bold text-gray-900 text-sm">Retail Storefront Settings</h4>
                                <Badge className="bg-orange-500 text-white text-[10px] font-bold px-2">Admin Control</Badge>
                            </div>
                            <div className="p-5 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-gray-700">Product Name</Label>
                                    <Input
                                        value={transferForm.name}
                                        onChange={e => setTransferForm({ ...transferForm, name: e.target.value })}
                                        placeholder="Display name in store"
                                        className="h-10 border-gray-300 focus:border-orange-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-gray-700">Barcode</Label>
                                    <Input
                                        value={transferForm.barcode}
                                        onChange={e => setTransferForm({ ...transferForm, barcode: e.target.value })}
                                        placeholder="SKU / Barcode"
                                        className="h-10 border-gray-300 focus:border-orange-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-gray-700">Category</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                        value={transferForm.category_id}
                                        onChange={e => setTransferForm({ ...transferForm, category_id: e.target.value })}
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-gray-700">Unit Type</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                        value={transferForm.unit_type_id}
                                        onChange={e => setTransferForm({ ...transferForm, unit_type_id: e.target.value })}
                                    >
                                        <option value="">Select Unit</option>
                                        {unitTypes.map(u => <option key={u.id} value={u.id}>{u.purchase_unit} / {u.sell_unit}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <Label className="text-xs font-bold text-gray-700">Product Description</Label>
                                    <Textarea
                                        rows={3}
                                        value={transferForm.description}
                                        onChange={e => setTransferForm({ ...transferForm, description: e.target.value })}
                                        placeholder="Add details for customers..."
                                        className="border-gray-300 focus:border-orange-500 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            <strong>Note:</strong> You can edit product details and set retail pricing before transferring to the customer storefront.
                        </p>

                        {/* ── Action Buttons ── */}
                        <div className="flex gap-3 pt-1">
                            <Button
                                variant="outline"
                                className="flex-1 h-12 font-semibold border-2"
                                onClick={() => setTransferModal({ show: false, item: null, qty: '1', allVariants: [] })}
                                disabled={transferLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 h-12 font-semibold bg-orange-500 hover:bg-orange-600 text-white"
                                onClick={handleTransfer}
                                disabled={
                                    transferLoading ||
                                    !transferModal.qty ||
                                    parseInt(transferModal.qty) < 1 ||
                                    parseInt(transferModal.qty) > item.warehouse_stock ||
                                    !transferForm.unit_type_id ||
                                    !transferForm.sell_price ||
                                    parseFloat(transferForm.sell_price) <= 0
                                }
                            >
                                {transferLoading ? 'Transferring...' : `Transfer ${transferModal.qty || 0} to Storefront`}
                            </Button>
                        </div>
                    </div>
                    );
                })()}
            </Modal>
        </div>
    );
}
