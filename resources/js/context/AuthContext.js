import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../lib/auth';
import api, { silentApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [settings, setSettings] = useState({});
    const [categories, setCategories] = useState([]);
    const [unitTypes, setUnitTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    const refreshSettings = async () => {
        try {
            const res = await silentApi.get('/settings', { params: { include_masterlist: 1, include_variants: 1 } });
            setSettings(res.data?.data || res.data || {});
        } catch (e) { }
    };

    const refreshCategories = async () => {
        try {
            const res = await silentApi.get('/categories');
            setCategories(res.data?.data || []);
        } catch (e) { }
    };

    const refreshUnitTypes = async () => {
        try {
            const res = await silentApi.get('/unit-types');
            setUnitTypes(res.data?.data || res.data || []);
        } catch (e) { }
    };

    const verifySession = async () => {
        try {
            const currentUser = await auth.getUser();
            if (currentUser) {
                setUser(currentUser);
            } else {
                setUser(null);
            }
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Run core fetches
        refreshCategories();
        // Silent check for HttpOnly session cookie native validation
        verifySession();
    }, []);

    const login = async (email, password, remember = false) => {
        const userData = await auth.login(email, password, remember);
        setUser(userData);
        verifySession();
        return userData;
    };

    const register = async (formData) => {
        const res = await api.post('/auth/register', formData);
        return res.data;
    };

    const logout = async () => {
        try {
            await auth.logout(user?.role);
        } catch (e) { }
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{
            user, setUser, loading,
            login, register, logout,
            settings, refreshSettings,
            categories, refreshCategories,
            unitTypes, refreshUnitTypes
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
