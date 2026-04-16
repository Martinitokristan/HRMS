import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import { StatusBadge } from '../shared/Badge';
import { useToast } from '../../context/ToastContext';
import RiderDetailsModal from './RiderDetailsModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Bike, Eye, CalendarCheck, UserCheck } from 'lucide-react';
import { useSilentRefresh } from '../../hooks/useSilentRefresh';
import { markStale, STALE_KEYS } from '../../store/dataStore';
import ConfirmModal from '../shared/ConfirmModal';

export default function Riders() {
    const { refreshTrigger } = useSilentRefresh(STALE_KEYS.ADMIN_RIDERS);
    const [riders, setRiders] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(riders.data?.length === 0); 
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedRider, setSelectedRider] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { showToast } = useToast();

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
            const res = await api.get('/riders', { params: { page, search, status: statusFilter === 'all' ? '' : statusFilter } });
            const paginatedData = res.data.data !== undefined ? res.data.data : res.data;
            setRiders({
                data: Array.isArray(paginatedData.data) ? paginatedData.data : (Array.isArray(paginatedData) ? paginatedData : []),
                total: paginatedData.total !== undefined ? paginatedData.total : (paginatedData.length || 0)
            });
        } catch (err) {
            console.error("Failed to fetch riders:", err);
            setRiders({ data: [], total: 0 });
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const debounce = setTimeout(() => {
            if (!isMounted) return;
            fetchData(riders.data?.length > 0);
        }, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, statusFilter, refreshTrigger]);

    const handleScheduleInterview = async (id) => {
        const datetime = prompt("Enter interview date and time (YYYY-MM-DD HH:MM):", new Date().toISOString().slice(0, 16).replace('T', ' '));
        if (!datetime) return;
        try {
            await api.post(`/riders/${id}/interview`, { interview_at: datetime });
            showToast('Interview scheduled!', 'success');
            markStale(STALE_KEYS.ADMIN_RIDERS);
            fetchData(true);
        } catch (err) {
            showToast('Failed to schedule interview', 'error');
        }
    };

    const performHire = async (id) => {
        closeConfirm();
        try {
            await api.post(`/riders/${id}/approve`);
            showToast('Rider hired and account activated!', 'success');
            markStale(STALE_KEYS.ADMIN_RIDERS);
            fetchData(true);
        } catch (err) {
            showToast('Failed to hire rider', 'error');
        }
    };

    const handleHire = (id) => {
        showConfirm(
            'Hire Rider',
            'Are you sure you want to hire and activate this rider?',
            () => performHire(id),
            'default'
        );
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Bike className="h-6 w-6 text-primary" /> Rider Fleet & Pipeline
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage rider applications and track fleet performance</p>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
                {[
                    { key: 'all', label: 'All Riders' },
                    { key: 'pending', label: 'Pending Apps' },
                    { key: 'interview_set', label: 'In Interview' },
                    { key: 'active', label: 'Active Fleet' }
                ].map(({ key, label }) => (
                    <Button key={key} variant={statusFilter === key ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(key)}>
                        {label}
                    </Button>
                ))}
            </div>

            <div className="mb-4">
                <FilterBar search={search} onSearchChange={v => { setSearch(v); setPage(1); }} />
            </div>

            <Card className="overflow-hidden mb-4">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Rider Info</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Details & ID</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Current Load</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Total Delivered</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">On-Time Rate</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Status/Stage</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-10"><div className="spinner mx-auto" /></TableCell></TableRow>
                        ) : riders.data?.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No riders found</TableCell></TableRow>
                        ) : riders.data?.map(r => (
                            <TableRow key={r.id} className={r.status === 'suspended' ? 'opacity-60' : ''}>
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">{r.name?.charAt(0)}</div>
                                        <div>
                                            <div className="font-semibold text-foreground">{r.name}</div>
                                            <div className="text-[12px] font-semibold text-muted-foreground">{r.email}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="text-sm">
                                        <div className="font-semibold text-primary">{r.rider_profile?.vehicle_type} - {r.rider_profile?.vehicle_model} ({r.rider_profile?.plate_number})</div>
                                        <div className="text-[11px] text-muted-foreground">License: {r.rider_profile?.license_number || 'N/A'}</div>
                                        {r.rider_profile?.valid_id_path && (
                                            <a 
                                                href={`/storage/${r.rider_profile.valid_id_path}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="text-[11px] underline text-primary mt-1 block"
                                            >
                                                View {r.rider_profile.valid_id_type}
                                            </a>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                    {r.active_deliveries_count > 0 
                                      ? <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">{r.active_deliveries_count} active</Badge>
                                      : <span className="text-muted-foreground text-sm">None</span>}
                                </TableCell>
                                <TableCell className="px-4 py-3 font-semibold text-foreground">{r.total_deliveries_count || 0}</TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-1.5 w-[60px] rounded-full bg-secondary overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{
                                                width: `${r.rider_profile?.on_time_rate || 0}%`, 
                                                background: (r.rider_profile?.on_time_rate || 0) > 90 ? '#22C55E' : '#F59E0B'
                                            }} />
                                        </div>
                                        <span className="text-[11px] text-muted-foreground">{r.rider_profile?.on_time_rate || 0}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                    <StatusBadge status={r.status || 'pending'} />
                                    {r.status === 'interview_set' && r.rider_profile?.interview_at && (
                                        <div className="text-[11px] text-muted-foreground mt-1">Interv: {new Date(r.rider_profile.interview_at).toLocaleDateString()}</div>
                                    )}
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                        {r.status === 'pending' && (
                                            <Button variant="outline" size="sm" onClick={() => handleScheduleInterview(r.id)} className="h-7 px-2 gap-1">
                                                <CalendarCheck className="h-3.5 w-3.5" /> Schedule
                                            </Button>
                                        )}
                                        {r.status === 'interview_set' && (
                                            <Button size="sm" onClick={() => handleHire(r.id)} className="h-7 px-2 gap-1">
                                                <UserCheck className="h-3.5 w-3.5" /> Hire
                                            </Button>
                                        )}
                                        {r.status === 'active' && (
                                            <Badge variant="outline" className="border-success/30 bg-success-light text-success-foreground text-[11px]">On Duty</Badge>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedRider(r); setIsModalOpen(true); }} className="h-7 px-2 gap-1">
                                            <Eye className="h-3.5 w-3.5" /> View
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={riders.total} perPage={15} onChange={setPage} />

            <RiderDetailsModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                rider={selectedRider} 
            />

            <ConfirmModal modal={confirmModal} onClose={closeConfirm} />
        </div>
    );
}
