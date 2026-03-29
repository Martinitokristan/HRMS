import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Settings, LogOut, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import NotificationPanel from '../shared/NotificationPanel';

export default function Topbar({ toggleSidebar }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [profileOpen, setProfileOpen] = useState(false);
    const [notiOpen, setNotiOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const notiRef = useRef(null);

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
            const res = await axios.get('/notifications');
            const data = res.data.data || res.data || [];
            setNotifications(Array.isArray(data) ? data.slice(0, 30) : []);
            setUnreadCount(Array.isArray(data) ? data.filter(n => !n.read_at).length : 0);
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
        <header className="fixed top-0 left-0 right-0 lg:left-[260px] z-[90] flex h-16 items-center justify-between border-b border-border bg-white px-5 shadow-sm">
            <div className="flex items-center gap-3">
                <button className={cn(topbarBtn, 'lg:hidden')} onClick={toggleSidebar}>
                    <Menu className="h-4.5 w-4.5" />
                </button>
                <h1 className="text-[17px] font-bold tracking-tight text-foreground">{getPageTitle()}</h1>
            </div>

            <div className="flex items-center gap-2">
                {/* Notification Bell */}
                <div className="relative" ref={notiRef}>
                    <button
                        className={topbarBtn}
                        onClick={() => { setNotiOpen(!notiOpen); setProfileOpen(false); }}
                    >
                        <Bell className="h-[18px] w-[18px]" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white border-2 border-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

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
                            if (n.data?.type === 'gcash_payment') return '💰 GCash';
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
                    <button
                        onClick={() => { setProfileOpen(!profileOpen); setNotiOpen(false); }}
                        className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-[10px]',
                            'bg-[#FFF1EB] text-[#FF6B35] font-bold text-sm',
                            'transition-all duration-200 hover:bg-[#FF6B35] hover:text-white'
                        )}
                    >
                        {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </button>

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
