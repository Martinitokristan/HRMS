import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FilterBar from '../shared/FilterBar';
import Pagination from '../shared/Pagination';
import { StatusBadge } from '../shared/Badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Users, Eye } from 'lucide-react';

export default function Customers() {
    const [customers, setCustomers] = useState({ data: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    useEffect(() => {
        let isMounted = true;
        const fetchCustomers = () => {
            if (!isMounted) return;
            setLoading(true);
            axios.get('/customers', { params: { page, search } })
                .then(res => {
                    const paginatedData = res.data.data;
                    if (isMounted) {
                        setCustomers({
                            data: paginatedData.data ? paginatedData.data : paginatedData,
                            total: paginatedData.total || paginatedData.length || 0
                        });
                    }
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        };
        const debounce = setTimeout(fetchCustomers, 400);
        return () => {
            clearTimeout(debounce);
            isMounted = false;
        };
    }, [page, search, refreshTrigger]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" /> Customer Database
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">View registered customers and their purchasing statistics</p>
                </div>
            </div>

            <div className="mb-4">
                <FilterBar search={search} onSearchChange={v => { setSearch(v); setPage(1); }} />
            </div>

            <Card className="overflow-hidden mb-4">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Customer Info</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Total Orders</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Lifetime Revenue</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Last Order Date</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Status</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-wider px-4">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10"><div className="spinner mx-auto" /></TableCell></TableRow>
                        ) : customers.data.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No customers found</TableCell></TableRow>
                        ) : customers.data.map(u => (
                            <TableRow key={u.id} className={u.status === 'suspended' ? 'opacity-60' : ''}>
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">{u.name.charAt(0)}</div>
                                        <div>
                                            <div className="font-semibold text-foreground">{u.name}</div>
                                            <div className="text-[12px] text-muted-foreground">{u.email}</div>
                                            <div className="text-[11px] text-muted-foreground">{u.phone || 'No phone'}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 font-semibold text-foreground">{u.sales_count}</TableCell>
                                <TableCell className="px-4 py-3 font-bold text-primary">₱{Number(u.total_spent || 0).toFixed(2)}</TableCell>
                                <TableCell className="px-4 py-3 text-muted-foreground">{u.last_order_date ? new Date(u.last_order_date).toLocaleDateString() : 'Never'}</TableCell>
                                <TableCell className="px-4 py-3"><StatusBadge status={u.status} /></TableCell>
                                <TableCell className="px-4 py-3">
                                    <Button variant="ghost" size="sm" onClick={() => alert('Customer detail view coming soon')} className="h-7 px-2 gap-1">
                                        <Eye className="h-3.5 w-3.5" /> View Orders
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Pagination page={page} total={customers.total} perPage={15} onChange={setPage} />
        </div>
    );
}
