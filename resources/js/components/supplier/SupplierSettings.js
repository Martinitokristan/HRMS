import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Trash2, User, FolderOpen, Lock, Bell, Ruler, Palette, Weight, RefreshCw } from 'lucide-react';
import SupplierVariantSettings from './SupplierVariantSettings';
import SupplierUnitSettings from './SupplierUnitSettings';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function SupplierSettings() {
    const { user, logout, refreshSettings, refreshCategories } = useAuth();
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.SUPPLIER_SETTINGS);
    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);
    const [loadingCats, setLoadingCats] = useState(false);
    const { showToast } = useToast();

    // State for Profile
    const [profile, setProfile] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        city: user?.city || '',
        address: user?.address || ''
    });

    // State for Password
    const [passwords, setPasswords] = useState({
        current_password: '',
        new_password: '',
        new_password_confirmation: ''
    });

    // State for Categories
    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState('');

    // State for Confirm Modal
    const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

    const showConfirm = (title, message, onConfirm, variant = 'default') => {
        setConfirmModal({ open: true, title, message, onConfirm, variant });
    };

    const closeConfirm = () => {
        setConfirmModal({ ...confirmModal, open: false });
    };

    const tabs = [
        { id: 'profile', label: 'Company Profile', Icon: User, isSystem: false },
        { id: 'security', label: 'Security & Auth', Icon: Lock, isSystem: false },
        { id: 'categories', label: 'Product Categories', Icon: FolderOpen, isSystem: false },
        { id: 'notifications', label: 'Notifications', Icon: Bell, isSystem: false },
        { id: 'sizes', label: 'Size Config', Icon: Ruler, isSystem: true },
        { id: 'colors', label: 'Color Palette', Icon: Palette, isSystem: true },
        { id: 'weights', label: 'Weight Units', Icon: Weight, isSystem: true },
        { id: 'units', label: 'Unit Types', Icon: RefreshCw, isSystem: true },
    ];

    useEffect(() => {
        if (activeTab === 'categories') {
            fetchCategories();
        }
    }, [activeTab, refreshTrigger]);

    useEffect(() => {
        if (user) {
            setProfile({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                city: user.city || '',
                address: user.address || ''
            });
        }
    }, [user]);

    const fetchCategories = async (silent = false) => {
        if (!silent) setLoadingCats(true);
        try {
            const res = await api.get('/supplier/categories');
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            setCategories(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        } finally {
            if (!silent) setLoadingCats(false);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/supplier/auth/profile', profile);
            showToast('Profile updated successfully', 'success');
            if (refreshSettings) await refreshSettings();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.new_password !== passwords.new_password_confirmation) {
            showToast('Passwords do not match', 'error');
            return;
        }
        setSaving(true);
        try {
            await api.put('/supplier/auth/change-password', passwords);
            showToast('Password changed successfully', 'success');
            setPasswords({ current_password: '', new_password: '', new_password_confirmation: '' });
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to change password', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCat.trim()) return;
        setSaving(true);
        try {
            await api.post('/supplier/categories', { name: newCat });
            markStale(STALE_KEYS.SUPPLIER_SETTINGS);
            setNewCat('');
            if (refreshSettings) await refreshSettings();
            if (refreshCategories) await refreshCategories();
            fetchCategories(true);
            showToast('Category added', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add category', 'error');
        } finally {
            setSaving(false);
        }
    };

    const performDeleteCategory = async (id) => {
        closeConfirm();
        try {
            await api.delete(`/supplier/categories/${id}`);
            markStale(STALE_KEYS.SUPPLIER_SETTINGS);
            if (refreshSettings) await refreshSettings();
            if (refreshCategories) await refreshCategories();
            fetchCategories(true);
            showToast('Category deleted', 'success');
        } catch (err) {
            showToast('Failed to delete category', 'error');
        }
    };

    const handleDeleteCategory = (id) => {
        showConfirm(
            'Delete Category',
            'Are you sure you want to delete this category? This action cannot be undone.',
            () => performDeleteCategory(id),
            'destructive'
        );
    };

    return (
        <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar */}
            <div className="w-full md:w-56 shrink-0">
                <Card className="p-3">
                    <nav className="space-y-1">
                        {tabs.filter(t => !t.isSystem).map(tab => (
                            <button
                                key={tab.id}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                    activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                }`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <tab.Icon className="h-4 w-4 shrink-0" />
                                {tab.label}
                            </button>
                        ))}
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-1 font-black">System Preferences</div>
                        {tabs.filter(t => t.isSystem).map(tab => (
                            <button
                                key={tab.id}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                    activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                }`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <tab.Icon className="h-4 w-4 shrink-0" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </Card>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                {activeTab === 'profile' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">Company Profile</h2>
                            <p className="text-sm text-muted-foreground mt-1">Manage your supplier information and contact details</p>
                        </div>

                        <Card className="p-5 mb-6 flex items-center gap-4 border-primary/10">
                            <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-black shadow-lg shadow-primary/20">
                                {user?.name?.charAt(0) || 'S'}
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground">{user?.name}</h4>
                                <p className="text-sm text-muted-foreground">Supplier Master Account • {user?.email}</p>
                            </div>
                        </Card>

                        <form onSubmit={handleSaveProfile}>
                            <Card className="p-5 mb-4">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Business Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Company Name</Label>
                                        <Input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} required />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Email Address</Label>
                                        <Input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} required />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Phone Number</Label>
                                        <Input type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>City</Label>
                                        <Input type="text" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5 col-span-1 sm:col-span-2">
                                        <Label>Business Address</Label>
                                        <Textarea rows={3} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} />
                                    </div>
                                </div>
                            </Card>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={saving} className="font-bold h-11 px-8 shadow-md">
                                    {saving ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 'Update Profile Info'}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">Security & Access</h2>
                            <p className="text-sm text-muted-foreground mt-1">Protect your account and change password</p>
                        </div>
                        <form onSubmit={handleChangePassword}>
                            <Card className="p-5 mb-4">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Modify Password</h3>
                                <div className="max-w-md space-y-4">
                                    <div className="space-y-1.5">
                                        <Label>Current System Password</Label>
                                        <Input type="password" value={passwords.current_password} onChange={e => setPasswords({ ...passwords, current_password: e.target.value })} required />
                                    </div>
                                    <div className="space-y-1.5 pt-2 border-t mt-2">
                                        <Label>New Secure Password</Label>
                                        <Input type="password" value={passwords.new_password} onChange={e => setPasswords({ ...passwords, new_password: e.target.value })} required minLength={8} />
                                        <p className="text-[10px] text-muted-foreground">Minimum 8 characters with letters and numbers recommended.</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Confirm New Password</Label>
                                        <Input type="password" value={passwords.new_password_confirmation} onChange={e => setPasswords({ ...passwords, new_password_confirmation: e.target.value })} required />
                                    </div>
                                </div>
                            </Card>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={saving} className="font-bold h-11 px-8 shadow-md">
                                    {saving ? 'Verifying...' : 'Update Password'}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'categories' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">Inventory Categories</h2>
                            <p className="text-sm text-muted-foreground mt-1">Organize your hardware catalog with custom categories</p>
                        </div>

                        <Card className="p-5 mb-4 border-dashed border-2 bg-secondary/5">
                            <form onSubmit={handleAddCategory} className="flex gap-3">
                                <Input className="flex-1 h-11" placeholder="New Category Name (e.g. Hand Tools, Electrical etc.)" value={newCat} onChange={e => setNewCat(e.target.value)} required />
                                <Button type="submit" disabled={saving} className="font-bold h-11">
                                    {saving ? 'Adding...' : '+ Add Category'}
                                </Button>
                            </form>
                        </Card>

                        <Card className="overflow-hidden shadow-sm">
                            {loadingCats ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Fetching Categories...</span>
                                </div>
                            ) : categories.length === 0 ? (
                                <div className="text-center py-12 px-6">
                                    <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                                    <h3 className="font-bold text-foreground">No Categories Defined</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Create categories to help organize your product catalog better.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {categories.map(cat => (
                                        <div key={cat.id} className="flex justify-between items-center px-4 py-3.5 hover:bg-secondary/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">ID-{cat.id}</div>
                                                <span className="font-bold text-sm text-foreground">{cat.name}</span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-8" onClick={() => handleDeleteCategory(cat.id)}>
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">Communication Manager</h2>
                            <p className="text-sm text-muted-foreground mt-1">Manage alerts for orders, payments, and system updates</p>
                        </div>
                        <Card className="divide-y divide-border overflow-hidden">
                            {[
                                { id: 'po', t: 'New Purchase Orders', d: 'Get real-time alerts when the warehouse creates a new PO for you' },
                                { id: 'status', t: 'Order Status Changes', d: 'Notifications when an order moves through fulfillment stages' },
                                { id: 'catalog', t: 'Catalog Activity', d: 'Alerts regarding your promoted product visibility and views' },
                                { id: 'payment', t: 'Settlement Alerts', d: 'Receive notifications about payment releases and processing' },
                            ].map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-secondary/5 transition-colors">
                                    <div className="pr-8">
                                        <div className="font-bold text-sm text-foreground">{item.t}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.d}</div>
                                    </div>
                                    <Switch defaultChecked className="data-[state=checked]:bg-primary" />
                                </div>
                            ))}
                        </Card>
                    </div>
                )}

                {(activeTab === 'sizes' || activeTab === 'colors' || activeTab === 'weights') && (
                    <SupplierVariantSettings initialTab={activeTab} />
                )}

                {activeTab === 'units' && (
                    <SupplierUnitSettings />
                )}
            </div>

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
