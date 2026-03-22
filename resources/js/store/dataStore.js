const _staleFlags = new Set();
const _listeners  = {};

export function markStale(...keys) {
    keys.forEach(key => {
        _staleFlags.add(key);
        (_listeners[key] || []).forEach(fn => {
            try { fn(); } catch (e) {}
        });
    });
}

export function isStale(key) {
    return _staleFlags.has(key);
}

export function clearStale(key) {
    _staleFlags.delete(key);
}

export function onStale(key, callback) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(callback);
    return () => {
        _listeners[key] = (_listeners[key] || []).filter(fn => fn !== callback);
    };
}
