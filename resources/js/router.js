import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import RealTimeSyncBridge from './components/shared/RealTimeSyncBridge';
import '../css/globals.css';

// Layout
import AdminLayout from './components/layout/AdminLayout';

// Auth
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import RiderRegister from './components/auth/RiderRegister';
import EmailVerification from './components/auth/EmailVerification';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';

// Landing
import Landing from './components/landing/Landing';

// Admin pages
import Dashboard from './components/dashboard/Dashboard';
import Products from './components/products/Products';
import Inventory from './components/inventory/Inventory';
import Delivery from './components/delivery/Delivery';
import Reports from './components/reports/Reports';
import Settings from './components/settings/Settings';
import Users from './components/users/Users';
import Customers from './components/users/Customers';
import Riders from './components/users/Riders';
import Suppliers from './components/suppliers/Suppliers';
import RatingAnalytics from './components/admin/RatingAnalytics';
import Reviews from './components/admin/Reviews';

// Customer Portal
import CustomerHome from './components/customer-portal/CustomerHome';
import CustomerOrder from './components/customer-portal/CustomerOrder';
import CartPage from './components/customer-portal/CartPage';
import OrderHistory from './components/customer-portal/OrderHistory';
import CustomerSettings from './components/customer-portal/CustomerSettings';
import ProductReviewsPage from './components/customer-portal/ProductReviewsPage';

// Rider App
import RiderApp from './components/rider/RiderApp';
import RiderDashboardV3 from './components/rider/RiderDashboardV3';

// Supplier Portal
import SupplierRegister from './components/supplier/SupplierRegister';
import SupplierDashboard from './components/supplier/SupplierDashboard';
import SupplierOrders from './components/supplier/SupplierOrders';
import SupplierProducts from './components/supplier/SupplierProducts';
import SupplierSettings from './components/supplier/SupplierSettings';
import SupplierLayout from './components/layout/SupplierLayout';
import SupplierPendingApproval from './components/supplier/SupplierPendingApproval';
import SupplierInventory from './components/supplier/SupplierInventory';

// Admin: Supplier Available Products
import SupplierCatalog from './components/suppliers/SupplierCatalog';

// Admin: Returns
import Returns from './components/admin/Returns';

// Admin: GCash Logs
import GCashLogs from './components/admin/GCashLogs';

// Public: GCash Proof Submission
import GCashProofSubmit from './components/gcash/GCashProofSubmit';

function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading-page"><div className="spinner" /></div>;
    
    // Always redirect to the unified login page regardless of role
    const loginPath = '/login';

    if (!user) return <Navigate to={loginPath} replace />;
    
    if (roles && !roles.includes(user.role)) {
        // Redirect based on their ACTUAL role if they hit the wrong area
        if (user.role === 'admin') return <Navigate to="/dashboard" replace />;
        if (user.role === 'rider') return <Navigate to="/rider" replace />;
        if (user.role === 'customer') return <Navigate to="/shop" replace />;
        if (user.role === 'supplier') return <Navigate to="/supplier/dashboard" replace />;
        return <Navigate to="/" replace />;
    }
    return children;
}

export default function AppRouter() {
    return (
        <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/rider/register" element={<RiderRegister />} />
            <Route path="/verify-email" element={<EmailVerification />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/submit-proof/:token" element={<GCashProofSubmit />} />

            {/* Admin — wrapped in AdminLayout */}
            <Route element={
                <ProtectedRoute roles={['admin']}>
                    <AdminLayout />
                </ProtectedRoute>
            }>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/inventory" element={<Inventory tab="stock" />} />
                <Route path="/inventory/sales" element={<Inventory tab="sales" />} />
                <Route path="/inventory/cancellations" element={<Inventory tab="cancellations" />} />
                <Route path="/inventory/requests" element={<Inventory tab="requests" />} />
                <Route path="/inventory/purchase" element={<Inventory tab="purchase" />} />
                <Route path="/delivery" element={<Delivery />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/rating-analytics" element={<RatingAnalytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/users" element={<Users />} />
                <Route path="/users/customers" element={<Customers />} />
                <Route path="/users/riders" element={<Riders />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/supplier-catalog" element={<SupplierCatalog />} />
                <Route path="/returns" element={<Returns />} />
                <Route path="/gcash-logs" element={<GCashLogs />} />
            </Route>

            {/* Customer Portal */}
            <Route element={
                <ProtectedRoute roles={['customer']}>
                    <Outlet />
                </ProtectedRoute>
            }>
                <Route path="/shop" element={<CustomerHome />} />
                <Route path="/shop/cart" element={<CartPage />} />
                <Route path="/shop/order" element={<CustomerOrder />} />
                <Route path="/shop/history" element={<OrderHistory />} />
                <Route path="/shop/settings" element={<CustomerSettings />} />
                <Route path="/shop/products/:id/reviews" element={<ProductReviewsPage />} />
            </Route>

            {/* Rider App */}
            <Route path="/rider" element={
                <ProtectedRoute roles={['rider']}>
                    <RiderDashboardV3 />
                </ProtectedRoute>
            } />

            {/* Supplier Portal */}
            <Route path="/supplier/register" element={<SupplierRegister />} />
            <Route path="/supplier/pending-approval" element={<SupplierPendingApproval />} />
            <Route element={
                <ProtectedRoute roles={['supplier']}>
                    <SupplierLayout />
                </ProtectedRoute>
            }>
                <Route path="/supplier/dashboard" element={<SupplierDashboard />} />
                <Route path="/supplier/products" element={<SupplierProducts />} />
                <Route path="/supplier/inventory" element={<SupplierInventory />} />
                <Route path="/supplier/requests" element={<SupplierOrders mode="requests" />} />
                <Route path="/supplier/orders" element={<SupplierOrders mode="completed" />} />
                <Route path="/supplier/settings" element={<SupplierSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

import { createRoot } from 'react-dom/client';

import PaymentToastContainer from './components/shared/PaymentToast';

// ... (imports remain same)

if (document.getElementById('app')) {
    const root = createRoot(document.getElementById('app'));
    root.render(
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <ToastProvider>
                    <RealTimeSyncBridge />
                    <PaymentToastContainer />
                    <AppRouter />
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
