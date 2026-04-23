import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { silentApi } from '../../lib/api';
import { Bell, Settings, LogOut, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import NotificationPanel from '../shared/NotificationPanel';
import Tooltip from '../shared/Tooltip';
import PaymentToastContainer from '../shared/PaymentToast';
import { GCashIcon } from '../icons/PaymentIcons';

export default function Topbar({ toggleSidebar, isCollapsed }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [profileOpen, setProfileOpen] = useState(false);
    const [notiOpen, setNotiOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const notiRef = useRef(null);
    const seenGcashIds = useRef(new Set());
    const initialFetchDone = useRef(false);
    const toastEnabledRef = useRef(true);

    // Fetch toast setting on mount
    useEffect(() => {
        silentApi.get('/settings').then(res => {
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            const val = data?.settings?.notifications?.gcash_payment_toast;
            toastEnabledRef.current = val === '1' || val === undefined || val === null;
        }).catch(() => {});
    }, []);

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/dashboard') return 'Dashboard';
        if (path.startsWith('/products')) return 'Products';
        if (path.startsWith('/inventory')) return 'Inventory Management';
        if (path.startsWith('/delivery')) return 'Delivery Kanban';
        if (path.startsWith('/reports')) return 'Reports & Analytics';
        if (path.startsWith('/users/customers')) return 'Customers';
        if (path.startsWith('/users/riders')) return 'Riders';
        if (path.startsWith('/users')) return 'User Management';
        if (path.startsWith('/settings')) return 'System Settings';
        if (path.startsWith('/supplier-catalog')) return 'Supplier Available Products';
        if (path.startsWith('/suppliers')) return 'Suppliers';
        return 'Admin Portal';
    };

    const fetchNotifications = async () => {
        try {
            const res = await silentApi.get('/notifications');
            const data = res.data?.data !== undefined ? res.data.data : res.data;
            const notis = Array.isArray(data) ? data : [];
            setNotifications(notis.slice(0, 30));
            setUnreadCount(notis.filter(n => !n.read_at).length);

            // Detect new GCash payment notifications and fire toast (if enabled)
            const gcashNotis = notis.filter(n => n.data?.type === 'gcash_payment');
            
            if (!initialFetchDone.current) {
                // First fetch — just record existing IDs, don't toast
                gcashNotis.forEach(n => seenGcashIds.current.add(n.id));
                initialFetchDone.current = true;
            } else if (toastEnabledRef.current) {
                // Subsequent fetches — toast for any new ones (only if enabled)
                gcashNotis.forEach(n => {
                    if (!seenGcashIds.current.has(n.id)) {
                        seenGcashIds.current.add(n.id);
                        PaymentToastContainer.show({
                            customerName: n.data.customer_name,
                            amount: n.data.amount,
                            phone: n.data.phone,
                            items: n.data.items || [],
                            orderNumber: n.data.order_number,
                        });
                    }
                });
            } else {
                // Toast disabled — still track IDs to avoid backlog when re-enabled
                gcashNotis.forEach(n => seenGcashIds.current.add(n.id));
            }
        } catch (e) { }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const topbarBtn = cn(
        'relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white',
        'text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground'
    );

    return (
        <header className={cn(
            "fixed top-0 left-0 right-0 z-[90] flex h-16 items-center justify-between border-b border-border bg-white px-5 shadow-sm transition-all duration-300",
            isCollapsed ? "lg:left-[80px]" : "lg:left-[260px]"
        )}>
            <div className="flex items-center gap-3">
                <Tooltip label="Menu" position="bottom">
                    <button className={cn(topbarBtn, 'lg:hidden')} onClick={toggleSidebar} aria-label="Menu">
                        <Menu className="h-4.5 w-4.5" />
                    </button>
                </Tooltip>
                <h1 className="text-[17px] font-bold tracking-tight text-foreground">{getPageTitle()}</h1>
            </div>

            <div className="flex items-center gap-2">
                {/* Notification Bell */}
                <div className="relative" ref={notiRef}>
                    <Tooltip label="Notifications" position="bottom">
                        <button
                            className={topbarBtn}
                            onClick={() => { setNotiOpen(!notiOpen); setProfileOpen(false); }}
                            aria-label="Notifications"
                        >
                            <Bell className="h-[18px] w-[18px]" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white border-2 border-white">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                    </Tooltip>

                    <NotificationPanel
                        notifications={notifications}
                        setNotifications={setNotifications}
                        unreadCount={unreadCount}
                        setUnreadCount={setUnreadCount}
                        isOpen={notiOpen}
                        onClose={() => setNotiOpen(false)}
                        apiPrefix="/notifications"
                        renderMessage={(n) => n.data?.message || n.message || 'New notification'}
                        renderLabel={(n) => {
                            if (n.data?.type === 'gcash_payment') return <span className="flex items-center gap-1"><GCashIcon size={14} /> GCash</span>;
                            return n.data?.supplier_name || n.data?.title || 'HRMS';
                        }}
                        isRead={(n) => !!n.read_at}
                        markReadUrl="/notifications/mark-all-read"
                        onRefresh={fetchNotifications}
                        onNotificationClick={(n) => {
                            if (n.data?.type === 'gcash_payment') {
                                navigate('/inventory?tab=gcash');
                            }
                            setNotiOpen(false);
                        }}
                    />
                </div>

                {/* Profile */}
                <div className="relative">
                    <Tooltip label="My Profile" position="bottom">
                        <button
                            onClick={() => { setProfileOpen(!profileOpen); setNotiOpen(false); }}
                            aria-label="My Profile"
                            className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-[10px]',
                                'bg-[#FFF1EB] text-[#FF6B35] font-bold text-sm',
                                'transition-all duration-200 hover:bg-[#FF6B35] hover:text-white'
                            )}
                        >
                            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                        </button>
                    </Tooltip>

                    {profileOpen && (
                        <>
                            <div className="fixed inset-0 z-[299]" onClick={() => setProfileOpen(false)} />
                            <div className="absolute right-0 top-[calc(100%+8px)] z-[300] w-[220px] overflow-hidden rounded-2xl border border-border bg-white shadow-modal">
                                <div className="border-b border-border px-4 py-3.5">
                                    <p className="font-semibold text-sm text-foreground">{user?.name}</p>
                                    <p className="text-[12px] text-muted-foreground truncate">{user?.email}</p>
                                    <span className="mt-1.5 inline-block rounded-full bg-[#FFF1EB] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FF6B35]">
                                        {user?.role}
                                    </span>
                                </div>
                                <button
                                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                >
                                    <Settings className="h-4 w-4" /> Settings
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[#EF4444] transition-colors hover:bg-[#FEF2F2]"
                                >
                                    <LogOut className="h-4 w-4" /> Logout
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
