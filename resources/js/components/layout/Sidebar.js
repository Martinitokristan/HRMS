import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Package, Warehouse, Truck, Handshake,
    Store, BarChart3, Users, Settings, ChevronDown,
    ShoppingBag, UserCheck, Bike, ExternalLink, Star, RotateCcw,
    MessageSquare,
} from 'lucide-react';
import { cn } from '../../lib/utils';

function NavItem({ to, icon: Icon, children, end = false, isActive: isActiveProp }) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium rounded-none transition-all duration-200',
                'border-l-[3px] border-transparent',
                (isActive || isActiveProp)
                    ? 'text-white bg-white/10 border-l-[#FF6B35]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
            )}
        >
            {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
            {children}
        </NavLink>
    );
}

function SectionLabel({ children }) {
    return (
        <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
            {children}
        </p>
    );
}

export default function Sidebar({ isOpen, onClose }) {
    const [usersOpen, setUsersOpen] = useState(false);
    const location = useLocation();
    const usersActive = location.pathname.startsWith('/users');

    React.useEffect(() => {
        if (usersActive) setUsersOpen(true);
    }, [usersActive]);

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
                'fixed top-0 left-0 z-[100] flex h-screen w-[260px] flex-col bg-[#0F172A] transition-transform duration-300',
                isOpen ? 'translate-x-0 shadow-[8px_0_30px_rgba(0,0,0,0.2)]' : '-translate-x-full lg:translate-x-0'
            )}>
                {/* Logo */}
                <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B35]">
                            <span className="text-[13px] font-black text-white">H</span>
                        </div>
                        <span className="text-[17px] font-bold tracking-tight text-white">
                            HRMS <span className="text-[#FF6B35]">Pro</span>
                        </span>
                    </div>
                    <span className="rounded-full bg-[#FF6B35] px-2 py-0.5 text-[10px] font-black text-white">v8</span>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3">
                    <SectionLabel>Main</SectionLabel>
                    <NavItem to="/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
                    <NavItem to="/products" icon={Package}>Products</NavItem>
                    <NavItem to="/inventory" icon={Warehouse} isActiveProp={location.pathname.startsWith('/inventory')}>
                        Inventory
                    </NavItem>
                    <NavItem to="/delivery" icon={Truck}>Delivery</NavItem>
                    <NavItem to="/suppliers" icon={Handshake}>Suppliers</NavItem>
                    <NavItem to="/supplier-catalog" icon={Store}>Supplier Catalog</NavItem>
                    <NavItem to="/returns" icon={RotateCcw}>Returns</NavItem>

                    <SectionLabel>Analytics</SectionLabel>
                    <NavItem to="/reports" icon={BarChart3}>Reports</NavItem>
                    <NavItem to="/reports/rating-analytics" icon={Star}>Rating Analytics</NavItem>
                    <NavItem to="/reviews" icon={MessageSquare}>Reviews</NavItem>

                    <SectionLabel>System</SectionLabel>

                    {/* Users Accordion */}
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
                        <span className="flex items-center gap-2.5">
                            <Users className="h-[18px] w-[18px] shrink-0" />
                            Users
                        </span>
                        <ChevronDown className={cn(
                            'h-4 w-4 transition-transform duration-200',
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

                    <NavItem to="/settings" icon={Settings}>Settings</NavItem>
                </nav>

                {/* Footer */}
                <div className="border-t border-white/[0.08] p-4">
                    <NavLink
                        to="/shop"
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        Customer Portal
                        <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                    </NavLink>
                </div>
            </aside>
        </>
    );
}
