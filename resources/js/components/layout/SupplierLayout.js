import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import axios from 'axios';
import {
    LayoutDashboard, Package, ShoppingCart, FolderOpen,
    Settings, Bell, LogOut, Menu, ChevronDown, Plus, X
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function SupplierLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { supplier, logout, categories } = useSupplierAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [profileOpen, setProfileOpen] = useState(false);
    const [catsOpen, setCatsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadNoti, setUnreadNoti] = useState(0);
    const [notiOpen, setNotiOpen] = useState(false);

    React.useEffect(() => {
        
        // Fetch notifications
        const fetchNotis = () => {
            axios.get('/notifications').then(res => {
                const data = res.data.data || [];
                setNotifications(data.slice(0, 10));
                setUnreadNoti(data.filter(n => !n.read_at).length);
            }).catch(() => {});
        };
        fetchNotis();
        const inv = setInterval(fetchNotis, 5000);
        return () => clearInterval(inv);
    }, []);

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/supplier/dashboard') return 'Dashboard';
        if (path.startsWith('/supplier/products')) return 'My Products';
        if (path.startsWith('/supplier/orders')) return 'Purchase Orders';
        if (path.startsWith('/supplier/settings')) return 'Settings';
        return 'Supplier Portal';
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItem = (to, Icon, label) => (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium rounded-none transition-all duration-200',
                'border-l-[3px] border-transparent',
                isActive
                    ? 'text-white bg-white/10 border-l-[#FF6B35]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
            )}
            onClick={() => setSidebarOpen(false)}
        >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
        </NavLink>
    );

    return (
        <div className="flex min-h-screen bg-background">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                'fixed top-0 left-0 z-[100] flex h-screen w-[260px] flex-col bg-[#0F172A] transition-transform duration-300',
                sidebarOpen ? 'translate-x-0 shadow-[8px_0_30px_rgba(0,0,0,0.2)]' : '-translate-x-full lg:translate-x-0'
            )}>
                {/* Logo */}
                <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B35]">
                            <span className="text-[13px] font-black text-white">H</span>
                        </div>
                        <span className="text-[17px] font-bold tracking-tight text-white">
                            HRMS <span className="text-[#FF6B35]">Supplier</span>
                        </span>
                    </div>
                    <button
                        className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:text-white"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3">
                    <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">Main</p>
                    {navItem('/supplier/dashboard', LayoutDashboard, 'Dashboard')}
                    {navItem('/supplier/products', Package, 'My Products')}
                    {navItem('/supplier/orders', ShoppingCart, 'Purchase Orders')}

                    {/* Category Accordion */}
                    <button
                        onClick={() => setCatsOpen(!catsOpen)}
                        className={cn(
                            'flex w-full items-center justify-between px-5 py-2.5 text-sm font-medium transition-all duration-200',
                            'border-l-[3px] border-transparent text-white/60 hover:text-white hover:bg-white/[0.06]'
                        )}
                    >
                        <span className="flex items-center gap-2.5">
                            <FolderOpen className="h-[18px] w-[18px] shrink-0" />
                            Category
                        </span>
                        <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', catsOpen && 'rotate-180')} />
                    </button>
                    <div className={cn('overflow-hidden transition-all duration-250', catsOpen ? 'max-h-60' : 'max-h-0')}>
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center">
                                <NavLink
                                    to={`/supplier/products?category_id=${cat.id}`}
                                    className={({ isActive }) => cn(
                                        'flex flex-1 items-center py-2 pl-[3.25rem] pr-3 text-[13px] transition-colors duration-200',
                                        isActive ? 'text-[#FF6B35] font-semibold' : 'text-white/55 hover:text-white'
                                    )}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    {cat.name}
                                </NavLink>
                                <button
                                    title="Add Product to this Category"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigate(`/supplier/products?category_id=${cat.id}&open_form=true`);
                                        setSidebarOpen(false);
                                    }}
                                    className="mr-3 flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <p className="px-5 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">System</p>
                    {navItem('/supplier/settings', Settings, 'Settings')}
                </nav>

                {/* Footer */}
                <div className="border-t border-white/[0.08] p-4">
                    <div className="flex items-center gap-3 px-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF6B35]/20 text-[#FF6B35] text-sm font-bold">
                            {supplier?.name?.charAt(0) || 'S'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{supplier?.name || 'Supplier'}</p>
                            <p className="truncate text-[11px] text-white/40">{supplier?.email || ''}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main area */}
            <div className="flex flex-1 flex-col lg:pl-[260px]">
                {/* Topbar */}
                <header className="fixed top-0 left-0 right-0 lg:left-[260px] z-[90] flex h-16 items-center justify-between border-b border-border bg-white px-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white text-muted-foreground transition-all hover:bg-secondary hover:text-foreground lg:hidden"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            <Menu className="h-[18px] w-[18px]" />
                        </button>
                        <h1 className="text-[17px] font-bold tracking-tight text-foreground">{getPageTitle()}</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                                onClick={() => { setNotiOpen(!notiOpen); setProfileOpen(false); }}
                            >
                                <Bell className="h-[18px] w-[18px]" />
                                {unreadNoti > 0 && (
                                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white border-2 border-white">
                                        {unreadNoti > 9 ? '9+' : unreadNoti}
                                    </span>
                                )}
                            </button>
                            {notiOpen && (
                                <>
                                    <div className="fixed inset-0 z-[299]" onClick={() => setNotiOpen(false)} />
                                    <div className="absolute right-0 top-[calc(100%+8px)] z-[300] w-[300px] max-h-[360px] flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
                                        <div className="border-b border-border px-4 py-3 font-bold text-foreground">Notifications</div>
                                        <div className="flex-1 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                                    <Bell className="h-7 w-7 mb-2 opacity-30" />
                                                    <p className="text-sm">No notifications</p>
                                                </div>
                                            ) : notifications.map(n => (
                                                <div 
                                                    key={n.id} 
                                                    className={cn('cursor-pointer border-b border-border/60 px-4 py-3 text-[13px] hover:bg-gray-50 transition-colors', !n.read_at && 'bg-[#EFF6FF] font-semibold')}
                                                    onClick={() => {
                                                        if (!n.read_at) {
                                                            axios.post('/notifications/mark-all-read').then(() => {
                                                                setNotifications(prev => prev.map(notif => ({ ...notif, read_at: new Date().toISOString() })));
                                                                setUnreadNoti(0);
                                                            });
                                                        }
                                                        setNotiOpen(false);
                                                        if (n.data?.type === 'purchase_order_request') {
                                                            navigate('/supplier/orders');
                                                        }
                                                    }}
                                                >
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <span className="text-[10px] font-bold text-[#FF6B35] tracking-wider">HRMS</span>
                                                        <span className="text-[10px] text-muted-foreground font-normal">
                                                            {new Date(n.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="leading-snug">{n.data?.message}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Profile */}
                        <div className="relative">
                            <button
                                onClick={() => { setProfileOpen(!profileOpen); setNotiOpen(false); }}
                                className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FFF1EB] text-[#FF6B35] font-bold text-sm transition-all hover:bg-[#FF6B35] hover:text-white"
                            >
                                {supplier?.name?.charAt(0)?.toUpperCase() || 'S'}
                            </button>
                            {profileOpen && (
                                <>
                                    <div className="fixed inset-0 z-[299]" onClick={() => setProfileOpen(false)} />
                                    <div className="absolute right-0 top-[calc(100%+8px)] z-[300] w-[220px] overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
                                        <div className="border-b border-border px-4 py-3.5">
                                            <p className="font-semibold text-sm text-foreground">{supplier?.name}</p>
                                            <p className="text-[12px] text-muted-foreground truncate">{supplier?.email}</p>
                                            <span className="mt-1.5 inline-block rounded-full bg-[#FFF1EB] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FF6B35]">Supplier</span>
                                        </div>
                                        <button
                                            onClick={() => { setProfileOpen(false); navigate('/supplier/settings'); }}
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

                <main className="flex-1 px-5 py-6 pt-[calc(64px+1.5rem)] lg:px-7 xl:px-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
