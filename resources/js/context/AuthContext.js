import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Set axios base URL once (outside component so it is set before any request)
axios.defaults.baseURL = '/api';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    // Start as true — we DON'T know yet if the token is valid
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('hrms_token');
        if (storedToken) {
            // Attach header before the me() call
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            axios.get('/auth/me')
                .then(res => setUser(res.data.data))
                .catch(() => {
                    localStorage.removeItem('hrms_token');
                    delete axios.defaults.headers.common['Authorization'];
                    setUser(null);
                })
                .finally(() => setLoading(false));
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
        const { token, data } = res.data;
        localStorage.setItem('hrms_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(data);
        return data;
    };

    const logout = async () => {
        try {
            await axios.post('/auth/logout');
        } catch (e) {}
        localStorage.removeItem('hrms_token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
