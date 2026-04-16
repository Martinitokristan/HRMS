import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Plus, 
    Search, 
    Filter, 
    Edit, 
    Trash2, 
    Package, 
    Barcode, 
    DollarSign,
    Eye,
    Star
} from 'lucide-react';
import api from '../../lib/api';

export default function ProductCatalog() {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchProducts();
        fetchCategories();
        fetchStats();
    }, [search, categoryFilter, statusFilter]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (categoryFilter) params.append('category_id', categoryFilter);
            if (statusFilter !== 'all') params.append('status', statusFilter);

            const response = await api.get(`/supplier/products?${params}`);
            setProducts(response.data.data !== undefined ? response.data.data : response.data);
        } catch (error) {
            sileo.error({ title: 'Failed to fetch products' });
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get('/supplier/categories');
            setCategories(response.data.data !== undefined ? response.data.data : response.data);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/supplier/stats');
            setStats(response.data.data !== undefined ? response.data.data : response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const deleteProduct = async (productId) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        
        try {
            await api.delete(`/supplier/products/${productId}`);
            sileo.success({ title: 'Product deleted successfully' });
            fetchProducts();
            fetchStats();
        } catch (error) {
            sileo.error({ title: 'Failed to delete product' });
        }
    };

    const toggleProductStatus = async (productId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        
        try {
            await api.put(`/supplier/products/${productId}`, { is_active: newStatus === 'active' });
            sileo.success({ title: `Product ${newStatus === 'active' ? 'activated' : 'deactivated'}` });
            fetchProducts();
            fetchStats();
        } catch (error) {
            sileo.error({ title: 'Failed to update product status' });
        }
    };

    const getStatusColor = (status) => {
        return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(amount || 0);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Product Catalog</h1>
                <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                                    <p className="text-2xl font-bold">{stats.total_products}</p>
                                </div>
                                <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Active Products</p>
                                    <p className="text-2xl font-bold">{stats.active_products}</p>
                                </div>
                                <Eye className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                                    <p className="text-2xl font-bold">{stats.total_orders}</p>
                                </div>
                                <DollarSign className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Avg Rating</p>
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                        <span className="text-2xl font-bold">{stats.avg_rating || 0}</span>
                                    </div>
                                </div>
                                <Star className="h-8 w-8 text-muted-foreground" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    placeholder="Search products..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All Categories</SelectItem>
                                {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Products Grid */}
            {loading ? (
                <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : products.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No products found</h3>
                        <p className="text-muted-foreground mb-4">
                            {search || categoryFilter || statusFilter !== 'all' 
                                ? 'Try adjusting your filters' 
                                : 'Get started by adding your first product'
                            }
                        </p>
                        {!search && !categoryFilter && statusFilter === 'all' && (
                            <Button onClick={() => setShowCreateModal(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Your First Product
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {products.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                            <div className="aspect-square bg-muted relative">
                                {product.image_path ? (
                                    <img
                                        src={`/storage/${product.image_path}`}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Package className="w-12 h-12 text-muted-foreground" />
                                    </div>
                                )}
                                <Badge className={`absolute top-2 right-2 ${getStatusColor(product.is_active ? 'active' : 'inactive')}`}>
                                    {product.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                            </div>
                            <CardContent className="p-4">
                                <div className="space-y-2">
                                    <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {product.description}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">
                                            {product.category?.name}
                                        </Badge>
                                        {product.variants_count > 0 && (
                                            <Badge variant="outline">
                                                {product.variants_count} variants
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold text-lg">
                                            {formatCurrency(product.price)}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Barcode className="w-3 h-3" />
                                            <span className="text-xs text-muted-foreground">
                                                {product.barcode}
                                            </span>
                                        </div>
                                    </div>
                                    {product.avg_rating && (
                                        <div className="flex items-center gap-1">
                                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                            <span className="text-sm">{product.avg_rating.toFixed(1)}</span>
                                            <span className="text-xs text-muted-foreground">
                                                ({product.reviews_count || 0})
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingProduct(product)}
                                        className="flex-1"
                                    >
                                        <Edit className="w-3 h-3 mr-1" />
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => toggleProductStatus(product.id, product.is_active ? 'active' : 'inactive')}
                                    >
                                        {product.is_active ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => deleteProduct(product.id)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
