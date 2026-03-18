// Simple in-memory cache for static data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useCache = () => {
    const get = (key) => {
        const item = cache.get(key);
        if (!item) return null;
        
        // Check if cache is expired
        if (Date.now() > item.expiry) {
            cache.delete(key);
            return null;
        }
        
        return item.data;
    };
    
    const set = (key, data) => {
        cache.set(key, {
            data,
            expiry: Date.now() + CACHE_TTL
        });
    };
    
    const invalidate = (key) => {
        cache.delete(key);
    };
    
    const clear = () => {
        cache.clear();
    };
    
    return { get, set, invalidate, clear };
};

// Hook for caching API calls
export const useCachedApi = () => {
    const cache = useCache();
    
    const fetchWithCache = async (key, fetcher, ttl = CACHE_TTL) => {
        // Try to get from cache first
        const cached = cache.get(key);
        if (cached) {
            return cached;
        }
        
        // Fetch fresh data
        const data = await fetcher();
        cache.set(key, data);
        return data;
    };
    
    return { fetchWithCache, cache };
};
