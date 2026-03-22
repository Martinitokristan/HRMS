import { useState, useEffect, useCallback } from 'react';
import { isStale, clearStale, onStale } from '../store/dataStore';

export function useSilentRefresh(staleKey) {
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const triggerRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // On mount: if already stale from another component,
    // refresh immediately
    useEffect(() => {
        if (isStale(staleKey)) {
            clearStale(staleKey);
            triggerRefresh();
        }
    }, [staleKey, triggerRefresh]);

    // Subscribe: fires when markStale(key) is called anywhere
    useEffect(() => {
        return onStale(staleKey, () => {
            clearStale(staleKey);
            triggerRefresh();
        });
    }, [staleKey, triggerRefresh]);

    // Visibility: only re-fetch if stale when user returns
    // to this browser tab
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' 
                && isStale(staleKey)) {
                clearStale(staleKey);
                triggerRefresh();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener(
            'visibilitychange', handleVisibility
        );
    }, [staleKey, triggerRefresh]);

    return { refreshTrigger, triggerRefresh };
}
