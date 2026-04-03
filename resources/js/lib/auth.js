import axios from 'axios';
import api, { silentApi } from './api';

// Base instance to grab Sanctum CSRF properly over same-origin
const sessionClient = axios.create({
    baseURL: window.location.origin,
    withCredentials: true,
});

export const auth = {
    csrf: async () => {
        return await sessionClient.get('/sanctum/csrf-cookie');
    },

    login: async (email, password, remember = false) => {
        // CSRF handshake before attempting post
        await auth.csrf();
        const res = await api.post('/login', { email, password, remember });
        return res.data;
    },

    // role is passed from AuthContext so the correct logout endpoint is called
    logout: async (role) => {
        if (role === 'supplier') {
            await api.post('/supplier/auth/logout');
        } else {
            await api.post('/logout');
        }
    },

    getUser: async () => {
        try {
            // Supplier pages must hit the supplier-guard endpoint so the session
            // is resolved via the supplier guard, not the web (admin) guard.
            const isSupplierPath = window.location.pathname.startsWith('/supplier');
            const endpoint = isSupplierPath ? '/supplier/auth/me' : '/me';
            const res = await silentApi.get(endpoint);
            return res.data;
        } catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                return null;
            }
            throw error;
        }
    }
};
