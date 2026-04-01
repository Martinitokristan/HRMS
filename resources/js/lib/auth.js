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

        // If response contains a supplier_token, store it for Bearer auth
        if (res.data.supplier_token) {
            sessionStorage.setItem('supplier_token', res.data.supplier_token);
        }

        return res.data;
    },

    logout: async () => {
        const isSupplier = !!sessionStorage.getItem('supplier_token');
        sessionStorage.removeItem('supplier_token');
        if (!isSupplier) {
            await api.post('/logout');
        }
    },

    getUser: async () => {
        try {
            const res = await silentApi.get('/me');
            return res.data; // MeController returns the User object directly
        } catch (error) {
            if (error.response && error.response.status === 401) {
                return null;
            }
            throw error;
        }
    }
};
