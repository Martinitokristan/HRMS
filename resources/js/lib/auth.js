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

    login: async (email, password) => {
        // CSRF handshake before attempting post
        await auth.csrf();
        
        // Post credentials exactly to the new LoginController
        const res = await api.post('/login', { email, password });
        return res.data;
    },

    logout: async () => {
        await api.post('/logout');
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
