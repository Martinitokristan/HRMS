import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SupplierAuthContext = createContext();

export const SupplierAuthProvider = ({ children }) => {
    const [supplier, setSupplier] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const token = localStorage.getItem('supplier_token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchProfile(isMounted);
        } else {
            setLoading(false);
        }
        return () => { isMounted = false; };
    }, []);

    const fetchProfile = async (isMounted = true) => {
        try {
            const res = await axios.get('/supplier/auth/profile');
            if (isMounted) {
                setSupplier(res.data.data);
            }
        } catch (err) {
            if (isMounted) {
                console.error('Failed to fetch supplier profile:', err);
                logout();
            }
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }
    };

    const login = async (email, password) => {
        const res = await axios.post('/supplier/auth/login', { email, password });
        const { token, supplier } = res.data.data;
        console.log('Login received token:', token ? token.substring(0, 20) + '...' : 'null');
        console.log('Token length:', token ? token.length : 0);
        localStorage.setItem('supplier_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setSupplier(supplier);
        return supplier;
    };

    const logout = () => {
        localStorage.removeItem('supplier_token');
        delete axios.defaults.headers.common['Authorization'];
        setSupplier(null);
    };

    const value = {
        supplier,
        loading,
        login,
        logout,
        isAuthenticated: !!supplier,
    };

    return (
        <SupplierAuthContext.Provider value={value}>
            {children}
        </SupplierAuthContext.Provider>
    );
};

export const useSupplierAuth = () => {
    const context = useContext(SupplierAuthContext);
    if (!context) {
        throw new Error('useSupplierAuth must be used within SupplierAuthProvider');
    }
    return context;
};
