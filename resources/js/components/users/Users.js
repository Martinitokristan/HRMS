import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import Modal from '../shared/Modal';
import { RoleBadge, StatusBadge } from '../shared/Badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users as UsersIcon, Plus, Pencil, ShieldOff, ShieldCheck } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function Users() {
    const { showToast } = useToast();
    const { refreshTrigger } = useSilentRefresh('admin_users');
    const [users, setUsers] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(users.data.length === 0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    const [modal, setModal] = useState({ open: false, user: null });
    const [formData, setFormData] = useState({ name: '', email: '', role: 'admin', phone: '', password: '' });
    const [saving, setSaving] = useState(false);

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

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get('/users', { params: { page, search, role: roleFilter } });
            const paginatedData = res.data.data;
            setUsers({
                data: paginatedData.data ? paginatedData.data : paginatedData,
                total: paginatedData.total || paginatedData.length || 0
            });
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchData(users.data.length > 0);
        }, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, roleFilter, refreshTrigger]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (modal.user) {
                await axios.put(`/users/${modal.user.id}`, formData);
                showToast('User updated successfully');
            } else {
                await axios.post('/users', formData);
                showToast('User created successfully');
            }
            markStale('admin_users');
            fetchData(true);
            setModal({ open: false, user: null });
        } catch (err) {
            showToast(err.response?.data?.message || 'Error saving user', 'error');
        } finally {
            setSaving(false);
        }
    };

    const performToggleStatus = async (userId, currentStatus) => {
        closeConfirm();
        try {
            await axios.put(`/users/${userId}/status`, { status: currentStatus === 'active' ? 'suspended' : 'active' });
            showToast('User status updated');
            markStale('admin_users');
            fetchData(true);
        } catch (e) {
            showToast('Failed to update status', 'error');
        }
    };

    const handleToggleStatus = (userId, currentStatus) => {
        showConfirm(
            'Toggle User Status',
            `Are you sure you want to ${currentStatus === 'active' ? 'suspend' : 'restore'} this user?`,
            () => performToggleStatus(userId, currentStatus),
            currentStatus === 'active' ? 'destructive' : 'default'
        );
    };

    const openEdit = (u) => {
        setFormData({ name: u.name, email: u.email, role: u.role, phone: u.phone || '', password: '' });
        setModal({ open: true, user: u });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <UsersIcon className="h-6 w-6 text-primary" /> User Management
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage admins, customers, and riders</p>
                </div>
                <Button onClick={() => { setFormData({ name: '', email: '', role: 'admin', phone: '', password: '' }); setModal({ open: true, user: null }); }} className="gap-2">
                    <Plus className="h-4 w-4" /> New User
                </Button>
            </div>

            <div className="mb-4">
                <FilterBar 
                    search={search} onSearchChange={v => { setSearch(v); setPage(1); }}
                    filters={[{
                        value: roleFilter, onChange: v => { setRoleFilter(v); setPage(1); },
                        options: [
                            { value: '', label: 'All Roles' },
                            { value: 'admin', label: 'Admins' },
                            { value: 'rider', label: 'Riders' },
                            { value: 'customer', label: 'Customers' }
                        ]
                    }]}
                />
            </div>

            <Card className="overflow-hidden mb-4">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">User</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Role</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Phone</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Status</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Joined</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10"><div className="spinner mx-auto" /></TableCell></TableRow>
                        ) : users.data.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No users found</TableCell></TableRow>
                        ) : users.data.map(u => (
                            <TableRow key={u.id} className={u.status === 'suspended' ? 'opacity-60' : ''}>
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">{u.name.charAt(0)}</div>
                                        <div>
                                            <div className="font-semibold text-foreground">{u.name}</div>
                                            <div className="text-[12px] text-muted-foreground">{u.email}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3"><RoleBadge role={u.role} /></TableCell>
                                <TableCell className="px-4 py-3 text-muted-foreground">{u.phone || '-'}</TableCell>
                                <TableCell className="px-4 py-3"><StatusBadge status={u.status} /></TableCell>
                                <TableCell className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="h-7 px-2 gap-1">
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                        <Button
                                            variant={u.status === 'active' ? 'destructive' : 'outline'}
                                            size="sm"
                                            onClick={() => handleToggleStatus(u.id, u.status)}
                                            className="h-7 px-2 gap-1"
                                        >
                                            {u.status === 'active' ? <><ShieldOff className="h-3.5 w-3.5" /> Suspend</> : <><ShieldCheck className="h-3.5 w-3.5" /> Restore</>}
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={users.total} perPage={15} onChange={setPage} />

            <Modal isOpen={modal.open} onClose={() => setModal({open: false, user: null})} title={modal.user ? 'Edit User' : 'New User'} size="sm">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    
                    {!modal.user && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <select id="role" required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                    <option value="admin">System Admin</option>
                                    <option value="rider">Delivery Rider (Auto-creates profile)</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" required minLength="8" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                            </div>
                        </>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Saving...' : 'Save User'}</Button>
                </form>
            </Modal>

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
