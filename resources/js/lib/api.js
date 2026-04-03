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
            const isSupplierPage = window.location.pathname.startsWith('/supplier');
            const loginPath = isSupplierPage ? '/supplier/login' : '/login';
            if (window.location.pathname !== loginPath && window.location.pathname !== '/') {
                window.location.href = loginPath;
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
