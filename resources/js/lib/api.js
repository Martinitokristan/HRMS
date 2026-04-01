import axios from 'axios';

const api = axios.create({
    baseURL: window.location.origin + '/api',
    withCredentials: true,
    headers: {
        'Accept': 'application/json',
    }
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            // Trigger global login redirect without full page reload if possible
            if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Special instance that DOES NOT redirect on 401 - for verifySession/background checks
export const silentApi = axios.create({
    baseURL: window.location.origin + '/api',
    withCredentials: true,
    headers: {
        'Accept': 'application/json',
    }
});

export default api;
