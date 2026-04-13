// Version suffix format: 'key:vN' — strip version at runtime so listeners
// are always registered against the base key. Bump the version constant here
// when a breaking schema/payload change requires all consumers to re-fetch.
export const STALE_KEY_VERSION = 'v1';

export const STALE_KEYS = {
    ADMIN_DASHBOARD: 'admin_dashboard',
    ADMIN_ORDERS: 'admin_orders',
    ADMIN_PURCHASES: 'admin_purchases',
    ADMIN_INVENTORY: 'admin_inventory',
    ADMIN_RETURNS: 'admin_returns',
    ADMIN_REVIEWS: 'admin_reviews',
    ADMIN_USERS: 'admin_users',
    ADMIN_NOTIFICATIONS: 'admin_notifications',
    ADMIN_DELIVERIES: 'admin_deliveries',
    ADMIN_PRODUCTS: 'admin_products',
    ADMIN_RIDERS: 'admin_riders',
    ADMIN_SUPPLIERS: 'admin_suppliers',
    ADMIN_SETTINGS: 'admin_settings',
    SUPPLIER_DASHBOARD: 'supplier_dashboard',
    SUPPLIER_ORDERS: 'supplier_orders',
    SUPPLIER_PRODUCTS: 'supplier_products',
    SUPPLIER_BRANDS: 'supplier_brands',
    SUPPLIER_NOTIFICATIONS: 'supplier_notifications',
    SUPPLIER_SETTINGS: 'supplier_settings',
    CUSTOMER_SHOP: 'customer_shop',
    CUSTOMER_ORDERS: 'customer_orders',
    CUSTOMER_CART: 'customer_cart',
    CUSTOMER_RETURNS: 'customer_returns',
    CUSTOMER_NOTIFICATIONS: 'customer_notifications',
    RIDER_DASHBOARD: 'rider_dashboard',
    RIDER_NOTIFICATIONS: 'rider_notifications',
    PRODUCT_REVIEWS: 'product_reviews',
};

const _staleFlags = new Set();
const _listeners  = {};

// Strip optional ':vN' suffix so versioned keys ('admin_orders:v2') resolve
// to the same base key that useSilentRefresh subscribes on.
function _baseKey(key) {
    const idx = key.indexOf(':');
    return idx !== -1 ? key.slice(0, idx) : key;
}

let _channel = null;
try {
    _channel = new BroadcastChannel('hrms_realtime');
    _channel.onmessage = (event) => {
        if (event.data && event.data.type === 'STALE_UPDATE') {
            const keys = event.data.keys;
            keys.forEach(key => {
                const base = _baseKey(key);
                _staleFlags.add(base);
                (_listeners[base] || []).forEach(fn => {
                    try { fn(); } catch (e) {}
                });
            });
        }
    };
} catch(e) {
    console.warn("BroadcastChannel not supported in this environment");
}

export function markStale(...keys) {
    keys.forEach(key => {
        const base = _baseKey(key);
        _staleFlags.add(base);
        (_listeners[base] || []).forEach(fn => {
            try { fn(); } catch (e) {}
        });
    });
    
    // Broadcast to other tabs silently
    if (_channel) {
        try {
            _channel.postMessage({ type: 'STALE_UPDATE', keys });
        } catch(e) {}
    }
}

export function isStale(key) {
    return _staleFlags.has(_baseKey(key));
}

export function clearStale(key) {
    _staleFlags.delete(_baseKey(key));
}

export function onStale(key, callback) {
    const base = _baseKey(key);
    if (!_listeners[base]) _listeners[base] = [];
    _listeners[base].push(callback);
    return () => {
        _listeners[base] = (_listeners[base] || []).filter(fn => fn !== callback);
    };
}
