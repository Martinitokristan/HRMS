import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSupplierAuth } from '../../context/SupplierAuthContext';

export default function SupplierLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { supplier, logout } = useSupplierAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [profileOpen, setProfileOpen] = useState(false);
    const [catsOpen, setCatsOpen] = useState(false);
    const [categories, setCategories] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadNoti, setUnreadNoti] = useState(0);
    const [notiOpen, setNotiOpen] = useState(false);

    React.useEffect(() => {
        // Fetch categories
        axios.get('/supplier/categories').then(res => setCategories(res.data.data)).catch(() => {});
        
        // Fetch notifications
        const fetchNotis = () => {
            axios.get('/notifications').then(res => {
                const data = res.data.data || [];
                setNotifications(data.slice(0, 10));
                setUnreadNoti(data.filter(n => !n.read_at).length);
            }).catch(() => {});
        };
        fetchNotis();
        const inv = setInterval(fetchNotis, 30000);
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

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className={`sidebar supplier-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar__logo">
                    <span>HRMS <span>Supplier</span></span>
                    <span className="logo-badge">Pro</span>
                </div>

                <nav className="sidebar__nav">
                    <div className="sidebar__section-label">Main</div>
                    <NavLink to="/supplier/dashboard" className={({ isActive }) => `sidebar__item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <span className="icon">📊</span> Dashboard
                    </NavLink>
                    
                    <NavLink to="/supplier/products" className={({ isActive }) => `sidebar__item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <span className="icon">📦</span> My Products
                    </NavLink>
                    <NavLink to="/supplier/orders" className={({ isActive }) => `sidebar__item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <span className="icon">🧾</span> Purchase Orders
                    </NavLink>
                    
                    {/* Category Dropdown (Moved below PO) */}
                    <button 
                        className={`sidebar__accordion-btn ${catsOpen ? 'active' : ''}`}
                        onClick={() => setCatsOpen(!catsOpen)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="icon">📂</span> Category
                        </div>
                        <span className={`arrow ${catsOpen ? 'open' : ''}`}>▼</span>
                    </button>
                    <div className={`sidebar__sub-items ${catsOpen ? 'open' : ''}`}>
                        {categories.map(cat => (
                            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <NavLink 
                                    to={`/supplier/products?category_id=${cat.id}`} 
                                    className="sidebar__sub-item"
                                    onClick={() => setSidebarOpen(false)}
                                    style={{ flex: 1 }}
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
                                    style={{
                                        background: 'rgba(52, 152, 219, 0.1)', border: 'none', color: '#3498db',
                                        cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', marginRight: '10px',
                                        fontSize: '0.8rem', fontWeight: 700
                                    }}>
                                    +
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="sidebar__section-label">System</div>
                    <NavLink to="/supplier/settings" className={({ isActive }) => `sidebar__item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <span className="icon">⚙️</span> Settings
                    </NavLink>
                </nav>

                <div className="sidebar__footer">
                    <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>
                            {supplier?.name || 'Supplier'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                            {supplier?.email || ''}
                        </div>
                    </div>
                </div>
            </aside>

            <div className="flex-1 w-full" style={{ width: '100%' }}>
                {/* Topbar */}
                <header className="topbar">
                    <div className="d-flex align-center gap-2">
                        <button className="topbar__btn topbar__hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            ☰
                        </button>
                        <h1 className="topbar__title">{getPageTitle()}</h1>
                    </div>

                    <div className="topbar__actions">
                        <div style={{ position: 'relative' }}>
                            <button className="topbar__btn relative" onClick={() => { setNotiOpen(!notiOpen); setProfileOpen(false); }}>
                                🔔
                                {unreadNoti > 0 && (
                                    <span style={{
                                        position: 'absolute', top: 2, right: 2, width: 16, height: 16,
                                        background: '#ef4444', color: '#fff', borderRadius: '50%',
                                        fontSize: '0.6rem', fontWeight: 700, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                    }}>{unreadNoti}</span>
                                )}
                            </button>
                            
                            {notiOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setNotiOpen(false)} />
                                    <div className="noti-dropdown" style={{
                                        position: 'absolute', right: 0, top: '100%', marginTop: 8,
                                        width: 300, background: '#fff', borderRadius: 12,
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0',
                                        zIndex: 300, overflow: 'hidden'
                                    }}>
                                        <div style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>Notifications</div>
                                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                            {notifications.length === 0 ? (
                                                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No notifications</div>
                                            ) : notifications.map(n => (
                                                <div key={n.id} style={{ padding: '10px 15px', borderBottom: '1px solid #f8fafc', background: n.read_at ? '#fff' : '#f0f9ff' }}>
                                                    <div style={{ fontSize: '0.8rem', color: '#1e293b' }}>{n.data?.message}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div style={{ position: 'relative' }}>
                            <div className="topbar__avatar" onClick={() => { setProfileOpen(!profileOpen); setNotiOpen(false); }}>
                                {supplier?.name?.charAt(0) || 'S'}
                            </div>

                            {profileOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setProfileOpen(false)} />
                                    <div className="profile-dropdown">
                                        <div className="profile-dropdown__user">
                                            <div className="name">{supplier?.name}</div>
                                            <div className="email">{supplier?.email}</div>
                                        </div>
                                        <div className="profile-dropdown__item" onClick={() => { setProfileOpen(false); navigate('/supplier/settings'); }}>
                                            Settings
                                        </div>
                                        <div className="profile-dropdown__item danger" onClick={handleLogout}>
                                            Logout
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <main className="main-content">
                    <Outlet />
                </main>
            </div>

            {sidebarOpen && (
                <div
                    className="modal-backdrop"
                    style={{ zIndex: 90 }}
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
}
