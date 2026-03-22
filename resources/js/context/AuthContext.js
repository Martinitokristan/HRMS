import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Set axios base URL once (outside component so it is set before any request)
axios.defaults.baseURL = '/api';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [settings, setSettings] = useState({});
    const [categories, setCategories] = useState([]);
    // Start as true — we DON'T know yet if the token is valid
    const [loading, setLoading] = useState(true);

    const refreshSettings = async () => {
        try {
            const res = await axios.get('/settings');
            setSettings(res.data);
        } catch (e) {}
    };

    const refreshCategories = async () => {
        try {
            const res = await axios.get('/categories');
            setCategories(res.data?.data || []);
        } catch (e) {}
    };

    useEffect(() => {
        const storedToken = localStorage.getItem('hrms_token');
        const supplierToken = localStorage.getItem('supplier_token');
        
        refreshCategories();
        
        if (storedToken) {
            // Priority: Attach HRMS token if it exists
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            axios.get('/auth/me')
                .then(res => setUser(res.data.data))
                .catch(() => {
                    localStorage.removeItem('hrms_token');
                    // Only delete header if there's no supplier token fallback
                    if (!localStorage.getItem('supplier_token')) {
                        delete axios.defaults.headers.common['Authorization'];
                    }
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else if (supplierToken) {
            // Secondary: If no HRMS token but a supplier token exists, use that
            axios.defaults.headers.common['Authorization'] = `Bearer ${supplierToken}`;
            setLoading(false);
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password, role = null) => {
        const res = await axios.post('/auth/login', { email, password, role });
        const { token, data } = res.data;
        localStorage.setItem('hrms_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(data);
        return data;
    };

    const register = async (formData) => {
        const res = await axios.post('/auth/register', formData);
        // Registration now requires email verification — no auto-login token returned
        return res.data;
    };

    const logout = async () => {
        try {
            await axios.post('/auth/logout');
        } catch (e) {}
        localStorage.removeItem('hrms_token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    const loginWithToken = (token, data) => {
        localStorage.setItem('hrms_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(data);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, loginWithToken, settings, refreshSettings, categories, refreshCategories }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
