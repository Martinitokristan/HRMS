import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Package, Warehouse, Truck, Handshake,
    Store, BarChart3, Users, Settings, ChevronDown,
    ShoppingBag, UserCheck, Bike, ExternalLink, Star, RotateCcw,
    MessageSquare, Smartphone, Menu, X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import Tooltip from '../shared/Tooltip';

function NavItem({ to, icon: Icon, children, end = false, isActive: isActiveProp, isCollapsed }) {
    const link = (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) => cn(
                'flex items-center gap-2.5 py-2.5 text-sm font-medium rounded-none transition-all duration-200',
                isCollapsed ? 'justify-center px-0' : 'px-5',
                'border-l-[3px] border-transparent',
                (isActive || isActiveProp)
                    ? 'text-white bg-white/10 border-l-[#FF6B35]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
            )}
        >
            {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
            {!isCollapsed && children}
        </NavLink>
    );

    if (isCollapsed) {
        return (
            <Tooltip label={children} position="right" delay={200}>
                {link}
            </Tooltip>
        );
    }

    return link;
}

function SectionLabel({ children, isCollapsed }) {
    if (isCollapsed) return <div className="h-px bg-white/10 my-3 mx-4" />;
    return (
        <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 truncate">
            {children}
        </p>
    );
}

export default function Sidebar({ isOpen, onClose, isCollapsed, toggleCollapse }) {
    const [usersOpen, setUsersOpen] = useState(false);
    const location = useLocation();
    const usersActive = location.pathname.startsWith('/users');

    React.useEffect(() => {
        if (usersActive && !isCollapsed) setUsersOpen(true);
    }, [usersActive, isCollapsed]);

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={cn(
                'fixed top-0 left-0 z-[100] flex h-screen flex-col bg-[#0F172A] transition-all duration-300',
                isCollapsed ? 'w-[80px]' : 'w-[260px]',
                isOpen ? 'translate-x-0 shadow-[8px_0_30px_rgba(0,0,0,0.2)]' : '-translate-x-full lg:translate-x-0'
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
                                    HRMS
                                </span>
                            </div>
                        )}
                        
                        <Tooltip label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} position="right" delay={200}>
                            <button
                                onClick={toggleCollapse}
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
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3 scrollbar-none">
                    <SectionLabel isCollapsed={isCollapsed}>Main</SectionLabel>
                    <NavItem to="/dashboard" icon={LayoutDashboard} isCollapsed={isCollapsed}>Dashboard</NavItem>
                    <NavItem to="/products" icon={Package} isCollapsed={isCollapsed}>Products</NavItem>
                    <NavItem to="/inventory" icon={Warehouse} isActiveProp={location.pathname.startsWith('/inventory')} isCollapsed={isCollapsed}>
                        Inventory
                    </NavItem>
                    <NavItem to="/delivery" icon={Truck} isCollapsed={isCollapsed}>Delivery</NavItem>
                    <NavItem to="/suppliers" icon={Handshake} isCollapsed={isCollapsed}>Suppliers</NavItem>
                    <NavItem to="/supplier-catalog" icon={Store} isCollapsed={isCollapsed}>Supplier Available Products</NavItem>
                    <NavItem to="/returns" icon={RotateCcw} isCollapsed={isCollapsed}>Returns</NavItem>
                    <NavItem to="/gcash-logs" icon={Smartphone} isCollapsed={isCollapsed}>GCash Payments</NavItem>

                    <SectionLabel isCollapsed={isCollapsed}>Analytics</SectionLabel>
                    <NavItem to="/reports" icon={BarChart3} end isCollapsed={isCollapsed}>Reports</NavItem>
                    <NavItem to="/reports/rating-analytics" icon={Star} isCollapsed={isCollapsed}>Rating Analytics</NavItem>
                    <NavItem to="/reviews" icon={MessageSquare} isCollapsed={isCollapsed}>Reviews</NavItem>

                    <SectionLabel isCollapsed={isCollapsed}>System</SectionLabel>

                    {/* Users Accordion or Icon if collapsed */}
                    {isCollapsed ? (
                        <NavItem to="/users" icon={Users} isCollapsed={isCollapsed}>Users</NavItem>
                    ) : (
                        <>
                            <button
                                onClick={() => setUsersOpen(!usersOpen)}
                                className={cn(
                                    'flex w-full items-center justify-between px-5 py-2.5 text-sm font-medium transition-all duration-200',
                                    'border-l-[3px]',
                                    usersActive
                                        ? 'text-white bg-white/10 border-l-[#FF6B35]'
                                        : 'text-white/60 hover:text-white hover:bg-white/[0.06] border-transparent'
                                )}
                            >
                                <span className="flex items-center gap-2.5 line-clamp-1">
                                    <Users className="h-[18px] w-[18px] shrink-0" />
                                    Users
                                </span>
                                <ChevronDown className={cn(
                                    'h-4 w-4 shrink-0 transition-transform duration-200',
                                    usersOpen && 'rotate-180'
                                )} />
                            </button>

                            <div className={cn(
                                'overflow-hidden transition-all duration-250',
                                usersOpen ? 'max-h-40' : 'max-h-0'
                            )}>
                                {[{ to: '/users', label: 'All Users', end: true, Icon: Users },
                                  { to: '/users/customers', label: 'Customers', Icon: UserCheck },
                                  { to: '/users/riders', label: 'Riders', Icon: Bike },
                                ].map(({ to, label, end, Icon }) => (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        end={end}
                                        className={({ isActive }) => cn(
                                            'flex items-center gap-2 py-2 pl-[3.25rem] pr-5 text-[13px] transition-colors duration-200',
                                            isActive ? 'text-[#FF6B35] font-semibold' : 'text-white/55 hover:text-white'
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        {label}
                                    </NavLink>
                                ))}
                            </div>
                        </>
                    )}

                    <NavItem to="/settings" icon={Settings} isCollapsed={isCollapsed}>Settings</NavItem>
                </nav>
            </aside>
        </>
    );
}
