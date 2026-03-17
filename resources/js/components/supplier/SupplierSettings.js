import React, { useState } from 'react';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import { useToast } from '../../context/ToastContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Trash2 } from 'lucide-react';

export default function SupplierSettings() {
    const { supplier, logout } = useSupplierAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);

    const [profile, setProfile] = useState({
        name: supplier?.name || '',
        email: supplier?.email || '',
        phone: supplier?.phone || '',
        address: supplier?.address || '',
        city: supplier?.city || '',
    });

    const [passwords, setPasswords] = useState({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
    });

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await axios.put('/supplier/auth/profile', profile);
            showToast('Profile updated successfully', 'success');
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
            await axios.put('/supplier/auth/change-password', passwords);
            showToast('Password changed successfully', 'success');
            setPasswords({ current_password: '', new_password: '', new_password_confirmation: '' });
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to change password', 'error');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: '👤' },
        { id: 'categories', label: 'Categories', icon: '📂' },
        { id: 'security', label: 'Security', icon: '🔒' },
        { id: 'notifications', label: 'Notifications', icon: '🔔' },
    ];

    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState('');
    const [loadingCats, setLoadingCats] = useState(false);

    React.useEffect(() => {
        if (activeTab === 'categories') fetchCategories();
    }, [activeTab]);

    const fetchCategories = async () => {
        setLoadingCats(true);
        try {
            const res = await axios.get('/supplier/categories');
            setCategories(res.data.data || []);
        } finally { setLoadingCats(false); }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCat.trim()) return;
        setSaving(true);
        try {
            await axios.post('/supplier/categories', { name: newCat });
            setNewCat('');
            fetchCategories();
            showToast('Category added', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add category', 'error');
        } finally { setSaving(false); }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm('Are you sure? This will delete the category.')) return;
        try {
            await axios.delete(`/supplier/categories/${id}`);
            fetchCategories();
            showToast('Category deleted', 'success');
        } catch (err) {
            showToast('Failed to delete category', 'error');
        }
    };

    return (
        <div className="flex gap-6">
            {/* Sidebar */}
            <div className="w-56 shrink-0">
                <nav className="space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                activeTab === tab.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {activeTab === 'categories' && (
                    <>
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">Product Categories</h2>
                            <p className="text-sm text-muted-foreground mt-1">Manage the categories used to organize your products</p>
                        </div>

                        <Card className="p-5 mb-4">
                            <form onSubmit={handleAddCategory} className="flex gap-3">
                                <Input className="flex-1" placeholder="Category Name (e.g. Variants, Size etc.)" value={newCat} onChange={e => setNewCat(e.target.value)} required />
                                <Button type="submit" disabled={saving}>{saving ? 'Adding...' : '+ Add Category'}</Button>
                            </form>
                        </Card>

                        <Card className="overflow-hidden">
                            {loadingCats ? <div className="flex justify-center py-8"><div className="spinner" /></div> : categories.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No categories created yet</div>
                            ) : categories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center px-4 py-3 border-b border-border/50 last:border-0">
                                    <span className="font-semibold text-sm text-foreground">{cat.name}</span>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8" onClick={() => handleDeleteCategory(cat.id)}>
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                    </Button>
                                </div>
                            ))}
                        </Card>
                    </>
                )}

                {activeTab === 'profile' && (
                    <>
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">Company Profile</h2>
                            <p className="text-sm text-muted-foreground mt-1">Manage your supplier information and contact details</p>
                        </div>

                        <Card className="p-5 mb-6 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-xl font-bold">{supplier?.name?.charAt(0) || 'S'}</div>
                            <div>
                                <h4 className="font-bold text-foreground">{supplier?.name}</h4>
                                <p className="text-sm text-muted-foreground">Supplier Account • {supplier?.email}</p>
                            </div>
                        </Card>

                        <form onSubmit={handleSaveProfile}>
                            <Card className="p-5 mb-4">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Business Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Company Name</Label>
                                        <Input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Email Address</Label>
                                        <Input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Phone Number</Label>
                                        <Input type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>City</Label>
                                        <Input type="text" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <Label>Complete Address</Label>
                                        <Textarea rows={3} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} />
                                    </div>
                                </div>
                            </Card>
                            <div className="flex justify-end pt-4 border-t border-border">
                                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                            </div>
                        </form>
                    </>
                )}

                {activeTab === 'security' && (
                    <>
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">Security Settings</h2>
                            <p className="text-sm text-muted-foreground mt-1">Change your password and manage security options</p>
                        </div>
                        <form onSubmit={handleChangePassword}>
                            <Card className="p-5 mb-4">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Change Password</h3>
                                <div className="max-w-md space-y-4">
                                    <div className="space-y-1.5">
                                        <Label>Current Password</Label>
                                        <Input type="password" value={passwords.current_password} onChange={e => setPasswords({ ...passwords, current_password: e.target.value })} required />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>New Password</Label>
                                        <Input type="password" value={passwords.new_password} onChange={e => setPasswords({ ...passwords, new_password: e.target.value })} required minLength={8} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Confirm New Password</Label>
                                        <Input type="password" value={passwords.new_password_confirmation} onChange={e => setPasswords({ ...passwords, new_password_confirmation: e.target.value })} required />
                                    </div>
                                </div>
                            </Card>
                            <div className="flex justify-end pt-4 border-t border-border">
                                <Button type="submit" disabled={saving}>{saving ? 'Updating...' : 'Update Password'}</Button>
                            </div>
                        </form>
                    </>
                )}

                {activeTab === 'notifications' && (
                    <>
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">Notification Preferences</h2>
                            <p className="text-sm text-muted-foreground mt-1">Control what notifications you receive</p>
                        </div>
                        <Card className="divide-y divide-border">
                            {[
                                { t: 'New Purchase Orders', d: 'Get notified when admin creates a new PO for you' },
                                { t: 'Order Status Updates', d: 'Notifications when PO status changes (approved, received)' },
                                { t: 'Product Catalog Updates', d: 'Alerts when your promoted products are viewed by admin' },
                                { t: 'Payment Notifications', d: 'Get notified about payment processing and settlements' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4">
                                    <div>
                                        <div className="font-semibold text-sm text-foreground">{item.t}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{item.d}</div>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                            ))}
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
