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
        await auth.csrf();
        const res = await api.post('/login', { email, password, remember });
        return res.data;
    },

    logout: async () => {
        await api.post('/logout');
    },

    getUser: async () => {
        try {
            const res = await silentApi.get('/me');
            return res.data;
        } catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                return null;
            }
            throw error;
        }
    }
};
