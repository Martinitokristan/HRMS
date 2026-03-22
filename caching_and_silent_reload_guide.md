# Optimistic UI & Silent Reload Implementation Guide

This document outlines the standard architectural pattern you should apply to all frontend components (`Admin`, [Customer](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/customer-portal/CustomerOrder.js#32-527), [Supplier](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/supplier/SupplierOrders.js#18-390), [Rider](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/rider/RiderApp.js#49-433)) to achieve the professional "Gold Standard" user experience:

1. **No Loading Spinners when Switching Tabs.**
2. **Silent Background Refreshes after Actions (Buying, Updating Stock).**
3. **No unnecessary Database Queries (Saving TiDB Request Units).**

---

## 1. The Core Concept

Currently, when a user switches tabs or clicks "Confirm", the application calls `setLoading(true)`. This completely wipes the screen white, forces the database to run heavy queries again, and shows a spinning wheel. 

Instead of doing this, we will use a **Cache + Silent Fetch Strategy**:
1. When opening a tab, instantly load the data from the browser's memory (`sessionStorage` or standard state).
2. Ask the server for fresh data quietly in the background (Silent Fetch). 
3. When actions occur (like placing an order), update the data quietly without wiping the screen.

---

## 2. Before vs. After (The Refactor Pattern)

Use this exact code pattern when updating your files.

### ❌ The Old Way (Spikes RUs & Flashes UI)
```javascript
export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducts(); // 🔴 Runs on EVERY tab switch, blindly hitting the database
    }, []);

    const fetchProducts = async () => {
        setLoading(true); // 🔴 Wipes the screen, shows spinner
        try {
            const res = await axios.get('/api/products');
            setProducts(res.data);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStock = async () => {
        await axios.post('/api/update-stock');
        fetchProducts(); // 🔴 Triggers setLoading(true) again = Jarring screen flash
    };
}
```

### ✅ The New Way (Session Caching & Silent Fetching)
```javascript
export default function ProductsPage() {
    // 1. Initialize from Cache if it exists so the tab loads instantly
    const [products, setProducts] = useState(() => {
        const cached = sessionStorage.getItem('admin_products_cache');
        return cached ? JSON.parse(cached) : [];
    });
    
    // 2. Only show the hard loading spinner IF we have zero data
    const [loading, setLoading] = useState(products.length === 0);

    useEffect(() => {
        // 3. Check for updates in the background slightly after loading
        fetchProducts(true); 
    }, []);

    // 4. Add the 'silent' parameter to prevent wiping the UI
    const fetchProducts = async (silent = false) => {
        // Only set loading if not silent AND we don't have cached data yet
        if (!silent && products.length === 0) setLoading(true); 
        
        try {
            const res = await axios.get('/api/products');
            setProducts(res.data);
            
            // 5. Save to SessionStorage so next tab-switch is purely instant memory
            sessionStorage.setItem('admin_products_cache', JSON.stringify(res.data));
        } catch (error) {
            console.error(error);
        } finally {
            if (!silent) setLoading(false); 
        }
    };

    const handleUpdateStock = async () => {
        await axios.post('/api/update-stock');
        // 6. Success toast + Silent Background Refresh
        showToast('Stock Updated Successfully!', 'success');
        fetchProducts(true); 
    };
}
```

---

## 3. Checklist for Updating Your Files

When converting any file (e.g., [SupplierOrders.js](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/supplier/SupplierOrders.js), `Inventory.js`, `Shop.js`), follow these exact 4 steps:

1. **Update `useState`**: Wrap your initial state to read from `sessionStorage.getItem('unique_key')` to provide an instant UI.
2. **Update the `useEffect` trigger**: Change it to [fetchData(true)](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/rider/RiderApp.js#91-110) so it performs a silent check behind the scenes whenever a tab is switched, instead of a hard load.
3. **Modify [fetchData(silent = false)](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/rider/RiderApp.js#91-110)**: Wrap `setLoading(true)` in an `if (!silent)` block. After setting your React state, make sure to save the new response to `sessionStorage.setItem()`.
4. **Update Action Handlers (Buttons/Forms)**: Find all functions like [handleAccept()](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/supplier/SupplierOrders.js#66-79), `handleDelete()`, or `updateStock()`. Make them show a success toast, then end with [fetchData(true)](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/rider/RiderApp.js#91-110).

---

## 4. Where specifically should you apply this?

Do not waste time applying this to every tiny file. You only need to apply this caching strategy to **High-Usage Data Grids**:
* **Admin / Inventory Manager:** `AdminProducts` list, Supplier list.
* **Supplier System:** [SupplierOrders](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/supplier/SupplierOrders.js#18-390) and [SupplierCatalog](file:///c:/xampp/htdocs/HRMSBOSHET/resources/js/components/suppliers/SupplierCatalog.js#17-432).
* **Customer Portal:** `Shop / CustomerCatalog`.
* **Rider Dashboard:** `DeliveriesList`.

These are the pages that users rapidly click between. Caching them drops your TiDB database load massively format. You do **NOT** need to cache small, fast pages like "Settings" or "Profile" since they load trivially fast and are rarely opened more than once.
