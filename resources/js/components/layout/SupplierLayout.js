import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { silentApi } from '../../lib/api';
import {
    LayoutDashboard, Package, ShoppingCart, FolderOpen,
    Settings, Bell, LogOut, Menu, ChevronDown, Plus, X, ClipboardList, Database
} from 'lucide-react';
import { cn } from '../../lib/utils';
import NotificationPanel from '../shared/NotificationPanel';
import Tooltip from '../shared/Tooltip';

export default function SupplierLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { user, logout, categories } = useAuth();
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
            silentApi.get('/supplier/notifications').then(res => {
                const data = res.data?.data !== undefined ? res.data.data : res.data;
                const notis = Array.isArray(data) ? data : [];
                setNotifications(notis.slice(0, 10));
                setUnreadNoti(notis.filter(n => !n.read_at).length);
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
        if (path.startsWith('/supplier/requests')) return 'Request Orders';
        if (path.startsWith('/supplier/orders')) return 'Purchase Orders';
        if (path.startsWith('/supplier/settings')) return 'Settings';
        return 'Supplier Portal';
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItem = (to, Icon, label) => {
        const link = (
            <NavLink
                to={to}
                className={({ isActive }) => cn(
                    'flex items-center gap-2.5 py-2.5 text-sm font-medium rounded-none transition-all duration-200',
                    isCollapsed ? 'justify-center px-0' : 'px-5',
                    'border-l-[3px] border-transparent',
                    isActive
                        ? 'text-white bg-white/10 border-l-[#FF6B35]'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                )}
                onClick={() => setSidebarOpen(false)}
            >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!isCollapsed && label}
            </NavLink>
        );
        if (isCollapsed) {
            return (
                <Tooltip label={label} position="right" delay={200} key={to}>
                    {link}
                </Tooltip>
            );
        }
        return link;
    };

    const SectionLabel = ({ children }) => {
        if (isCollapsed) return <div className="h-px bg-white/10 my-3 mx-4" />;
        return (
            <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 truncate">
                {children}
            </p>
        );
    };

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
                'fixed top-0 left-0 z-[100] flex h-screen flex-col bg-[#0F172A] transition-all duration-300',
                isCollapsed ? 'w-[80px]' : 'w-[260px]',
                sidebarOpen ? 'translate-x-0 shadow-[8px_0_30px_rgba(0,0,0,0.2)]' : '-translate-x-full lg:translate-x-0'
            )}>
                {/* Logo wrapper */}
                <div className={cn(
                    "flex flex-col gap-2 border-b border-white/[0.08] px-5 py-4",
                    isCollapsed && "px-0 items-center"
                )}>
                    <div className={cn(
                        "flex items-center",
                        isCollapsed ? "justify-center" : "justify-between"
                    )}>
                        {!isCollapsed && (
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B35]">
                                    <span className="text-[13px] font-black text-white">H</span>
                                </div>
                                <span className="text-[17px] font-bold tracking-tight text-white line-clamp-1">
                                    HRMS <span className="text-[#FF6B35]">Supplier</span>
                                </span>
                            </div>
                        )}
                        
                        <Tooltip label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} position="right" delay={200}>
                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                                className="hidden lg:flex group items-center justify-center h-8 w-8 rounded-lg text-white hover:bg-[#374151] transition-colors relative"
                            >
                                {!isCollapsed ? (
                                    <>
                                        <Menu size={18} className="absolute inset-0 m-auto transition-opacity duration-200 group-hover:opacity-0" />
                                        <X size={18} className="absolute inset-0 m-auto transition-opacity duration-200 opacity-0 group-hover:opacity-100" />
                                    </>
                                ) : (
                                    <Menu size={18} />
                                )}
                            </button>
                        </Tooltip>
                        
                        <button
                            className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:text-white"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3 scrollbar-none">
                    <SectionLabel>Main</SectionLabel>
                    {navItem('/supplier/dashboard', LayoutDashboard, 'Dashboard')}
                    {navItem('/supplier/products', Package, 'My Products')}
                    {navItem('/supplier/inventory', Database, 'Product Inventory')}
                    {navItem('/supplier/requests', ClipboardList, 'Request Orders')}
                    {navItem('/supplier/orders', ShoppingCart, 'Purchase Orders')}

                    {/* Category Accordion */}
                    {isCollapsed ? (
                        navItem('/supplier/products', FolderOpen, 'Categories')
                    ) : (
                        <>
                            <button
                                onClick={() => setCatsOpen(!catsOpen)}
                                className={cn(
                                    'flex w-full items-center justify-between px-5 py-2.5 text-sm font-medium transition-all duration-200',
                                    'border-l-[3px] border-transparent text-white/60 hover:text-white hover:bg-white/[0.06]'
                                )}
                            >
                                <span className="flex items-center gap-2.5 line-clamp-1">
                                    <FolderOpen className="h-[18px] w-[18px] shrink-0" />
                                    Category
                                </span>
                                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', catsOpen && 'rotate-180')} />
                            </button>
                            <div className={cn('overflow-hidden transition-all duration-250', catsOpen ? 'max-h-60' : 'max-h-0')}>
                                {categories?.length > 0 && categories.map(cat => (
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
                                        <Tooltip label="Add Product" position="right" delay={200}>
                                            <button
                                                aria-label="Add Product to this Category"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    navigate(`/supplier/products?category_id=${cat.id}&open_form=true`);
                                                    setSidebarOpen(false);
                                                }}
                                                className="mr-3 flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white shrink-0"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                        </Tooltip>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <SectionLabel>System</SectionLabel>
                    {navItem('/supplier/settings', Settings, 'Settings')}
                </nav>

                {/* Footer */}
                <div className={cn("border-t border-white/[0.08] p-4", isCollapsed && "px-2 py-4 flex justify-center")}>
                    <div className={cn("flex items-center gap-3", !isCollapsed ? "px-1" : "")}>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF6B35]/20 text-[#FF6B35] text-sm font-bold">
                            {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{user?.name || 'Supplier'}</p>
                                <p className="truncate text-[11px] text-white/40">{user?.email || ''}</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main area */}
            <div className={cn(
                "flex flex-1 flex-col transition-all duration-300",
                isCollapsed ? "lg:pl-[80px]" : "lg:pl-[260px]"
            )}>
                {/* Topbar */}
                <header className={cn(
                    "fixed top-0 left-0 right-0 z-[90] flex h-16 items-center justify-between border-b border-border bg-white px-5 shadow-sm transition-all duration-300",
                    isCollapsed ? "lg:left-[80px]" : "lg:left-[260px]"
                )}>
                    <div className="flex items-center gap-3">
                        <Tooltip label="Menu" position="bottom">
                            <button
                                className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white text-muted-foreground transition-all hover:bg-secondary hover:text-foreground lg:hidden"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                aria-label="Menu"
                            >
                                <Menu className="h-[18px] w-[18px]" />
                            </button>
                        </Tooltip>
                        <h1 className="text-[17px] font-bold tracking-tight text-foreground">{getPageTitle()}</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Notification Bell */}
                        <div className="relative">
                            <Tooltip label="Notifications" position="bottom">
                                <button
                                    className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                                    onClick={() => { setNotiOpen(!notiOpen); setProfileOpen(false); }}
                                    aria-label="Notifications"
                                >
                                    <Bell className="h-[18px] w-[18px]" />
                                    {unreadNoti > 0 && (
                                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white border-2 border-white">
                                            {unreadNoti > 9 ? '9+' : unreadNoti}
                                        </span>
                                    )}
                                </button>
                            </Tooltip>
                            <NotificationPanel
                                notifications={notifications}
                                setNotifications={setNotifications}
                                unreadCount={unreadNoti}
                                setUnreadCount={setUnreadNoti}
                                isOpen={notiOpen}
                                onClose={() => setNotiOpen(false)}
                                apiPrefix="/supplier/notifications"
                                renderMessage={(n) => n.data?.message || 'New notification'}
                                renderLabel={(n) => n.data?.title || 'HRMS'}
                                isRead={(n) => !!n.read_at}
                                markReadUrl="/supplier/notifications/mark-all-read"
                                onRefresh={() => {
                                    silentApi.get('/supplier/notifications').then(res => {
                                        const data = res.data?.data !== undefined ? res.data.data : res.data;
                                        const notis = Array.isArray(data) ? data : [];
                                        setNotifications(notis.slice(0, 10));
                                        setUnreadNoti(notis.filter(n => !n.read_at).length);
                                    }).catch(() => {});
                                }}
                                onNotificationClick={(n) => {
                                    if (n.data?.type === 'purchase_order_request') {
                                        navigate('/supplier/orders');
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
                                        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FFF1EB] text-[#FF6B35] font-bold text-sm transition-all hover:bg-[#FF6B35] hover:text-white"
                                        aria-label="My Profile"
                                    >
                                        {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                                    </button>
                                </Tooltip>
                                {profileOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[299]" onClick={() => setProfileOpen(false)} />
                                        <div className="absolute right-0 top-[calc(100%+8px)] z-[300] w-[220px] overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
                                            <div className="border-b border-border px-4 py-3.5">
                                                <p className="font-semibold text-sm text-foreground">{user?.name}</p>
                                                <p className="text-[12px] text-muted-foreground truncate">{user?.email}</p>
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
