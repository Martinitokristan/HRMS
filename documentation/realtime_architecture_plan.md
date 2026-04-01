# Real-Time Multi-Device Architecture Plan
**Generated:** 2026-04-01  
**Updated:** 2026-04-01 (v2 — versioned stale keys, Vite env fix, heartbeat/reconnect)  
**Status:** Ready to Implement

---

## Overview

Current system uses `markStale()` + `BroadcastChannel` (browser-only API).  
This only propagates UI updates within the **same browser on the same device**.  
This plan upgrades to full **WebSocket-based multi-device real-time sync**.

### Target Flow
```
User mutates (any device)
  → Laravel Controller responds
  → Fires DataMutated event (ShouldBroadcast)
  → Soketi/Pusher broadcasts via WebSocket
  → All connected devices receive message
  → RealTimeSyncBridge.js calls markStale(keys)
  → useSilentRefresh fires re-fetch silently
  → UI updates — no page reload
```

---

## Step 1: Install & Configure Soketi (WebSocket Server)

**Soketi** is recommended: self-hosted, free, Pusher-compatible, runs on XAMPP locally.

```bash
npm install -g @soketi/soketi
soketi start
```

### .env changes
```env
BROADCAST_DRIVER=pusher
PUSHER_APP_ID=hrms-app
PUSHER_APP_KEY=hrms-key
PUSHER_APP_SECRET=hrms-secret
PUSHER_HOST=127.0.0.1
PUSHER_PORT=6001
PUSHER_SCHEME=http
PUSHER_APP_CLUSTER=mt1
```

### config/broadcasting.php — add to pusher options block
```php
'host'   => env('PUSHER_HOST', '127.0.0.1'),
'port'   => env('PUSHER_PORT', 6001),
'scheme' => env('PUSHER_SCHEME', 'http'),
'useTLS' => false,
```

---

## Step 2: Create the Reusable DataMutated Event

**File:** `app/Events/DataMutated.php`

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DataMutated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $channel,
        public array  $staleKeys,
        public string $eventType
    ) {}

    public function broadcastOn(): array
    {
        if (str_starts_with($this->channel, 'private-')) {
            return [new PrivateChannel(substr($this->channel, 8))];
        }
        return [new Channel($this->channel)];
    }

    public function broadcastAs(): string
    {
        return 'data.mutated';
    }

    public function broadcastWith(): array
    {
        return [
            'stale_keys' => $this->staleKeys,
            'event_type' => $this->eventType,
        ];
    }
}
```

---

## Step 3: Wire Channel Authorization

**File:** `routes/channels.php`

```php
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('admin', function ($user) {
    return $user->role === 'admin';
});

Broadcast::channel('supplier.{id}', function ($user, $id) {
    return $user->supplier_id === (int) $id;
});

Broadcast::channel('customer.{id}', function ($user, $id) {
    return $user->id === (int) $id;
});

Broadcast::channel('rider.{id}', function ($user, $id) {
    return $user->id === (int) $id;
});
```

Sanctum already protects `/broadcasting/auth` — no extra middleware needed.

---

## Step 4: Add broadcast() Calls to Controllers

### Channel Map

| Domain | Channel | Type |
|---|---|---|
| Admin operations | `private-admin` | Private |
| Supplier-specific | `private-supplier.{supplier_id}` | Private |
| Customer-specific | `private-customer.{customer_id}` | Private |
| Rider-specific | `private-rider.{rider_id}` | Private |
| Public shop changes | `shop` | Public |

### Controller → Keys Reference

| Controller Method | Channels to Broadcast | Stale Keys |
|---|---|---|
| `ProductController::store/update/destroy` | `private-admin`, `shop` | `admin_products, customer_shop, supplier_products` |
| `InventoryController::transferToStore` | `private-admin`, `shop` | `admin_inventory, customer_shop` |
| `PurchaseOrderController::approve/decline/receive` | `private-admin`, `private-supplier.{id}` | `admin_purchases, admin_inventory, admin_dashboard, supplier_orders, supplier_dashboard` |
| `SupplierProductController::store/update/destroy` | `private-supplier.{id}`, `private-admin`, `shop` | `supplier_products, admin_inventory, customer_shop` |
| `SaleController::store` | `private-admin`, `private-customer.{id}` | `admin_orders, admin_dashboard, customer_orders, customer_cart` |
| `SaleController::updateStatus` | `private-admin`, `private-customer.{id}` | `admin_orders, admin_dashboard, customer_orders, admin_deliveries` |
| `SaleController::processReturn` | `private-admin`, `private-customer.{id}` | `admin_orders, admin_inventory, admin_dashboard, customer_orders` |
| `DeliveryController::updateStatus` | `private-admin`, `private-customer.{id}`, `private-rider.{id}` | `rider_dashboard, admin_dashboard, customer_orders` |
| `DeliveryController::selfAssign/decline` | `private-admin`, `private-rider.{id}` | `rider_dashboard, admin_dashboard, customer_orders` |
| `DeliveryController::uploadProof` | `private-admin`, `private-customer.{id}` | `rider_dashboard, admin_dashboard, customer_orders` |
| `ReturnController::approve/reject/complete` | `private-admin`, `private-customer.{id}` | `admin_returns, customer_returns, admin_inventory, admin_dashboard` |
| `ReturnController::store` (customer) | `private-admin`, `private-customer.{id}` | `admin_returns, customer_orders, admin_dashboard` |
| `ProductReviewController::store/updateStatus/destroy` | `private-admin`, `shop` | `admin_reviews, product_reviews, customer_shop` |
| `UserController::store/update/destroy` | `private-admin` | `admin_users` |
| `RiderController::approve/interview` | `private-admin` | `admin_riders` |
| `SettingsController` variants/categories | `private-admin`, `private-supplier.{id}` | `supplier_settings` |

### Example Usage in Controller
```php
// After successful mutation:
broadcast(new \App\Events\DataMutated(
    channel: 'private-admin',
    staleKeys: ['admin_purchases', 'admin_inventory', 'admin_dashboard'],
    eventType: 'purchase_order.approved'
));

// Also notify the specific supplier:
broadcast(new \App\Events\DataMutated(
    channel: "private-supplier.{$order->supplier_id}",
    staleKeys: ['supplier_orders', 'supplier_dashboard'],
    eventType: 'purchase_order.approved'
));
```

---

## Step 5: Install Frontend Dependencies

```bash
npm install laravel-echo pusher-js
```

---

## Step 6: Create RealTimeSyncBridge Component

**File:** `resources/js/components/shared/RealTimeSyncBridge.js`  
✅ **Already created** — see the actual file. Key improvements over draft:

### Improvement A — Correct Vite Env Vars
All browser-side env vars **must be prefixed `VITE_`** for Vite to expose them in the bundle.
`process.env.*` and non-prefixed vars are **server-side only** and will be `undefined` in the browser.

```javascript
// ✅ Correct — Vite exposes these to the browser bundle
key:      import.meta.env.VITE_PUSHER_APP_KEY,
wsHost:   import.meta.env.VITE_PUSHER_HOST    ?? '127.0.0.1',
wsPort:   Number(import.meta.env.VITE_PUSHER_PORT)   || 6001,
forceTLS: import.meta.env.VITE_PUSHER_SCHEME === 'https',

// ❌ Wrong — these are undefined in the browser
key: process.env.PUSHER_APP_KEY,
key: import.meta.env.PUSHER_APP_KEY,  // missing VITE_ prefix
```

### Improvement B — Heartbeat + Reconnect Logic
Mobile devices and spotty connections cause **silent WebSocket drops** where the socket
appears open but no messages arrive. The bridge handles this with:

- **Heartbeat timer** (every 30s): checks `pusher.connection.state`. If not `connected`, triggers reconnect.
- **Pusher connection events**: binds to `disconnected` and `failed` to catch explicit drops.
- **Reconnect with delay** (5s): destroys the old Echo instance and rebuilds cleanly.
- **`isMounted` ref guard**: prevents reconnect attempts after the component unmounts (e.g. logout).

```javascript
// Heartbeat — detects silent drops
heartbeatTimer.current = setInterval(() => {
    const state = echo.connector?.pusher?.connection?.state;
    if (state && state !== 'connected') scheduleReconnect();
}, 30_000);

// Explicit drop events from Pusher SDK
echo.connector.pusher.connection.bind('disconnected', () => scheduleReconnect());
echo.connector.pusher.connection.bind('failed',       () => scheduleReconnect());

// Reconnect — destroy + rebuild after 5s
function scheduleReconnect() {
    clearInterval(heartbeatTimer.current);
    destroyEcho();
    reconnectTimer.current = setTimeout(() => connect(), 5_000);
}
```

---

## Step 7: Mount Bridge at App Root

In your root layout (`App.js` or the admin/supplier/customer layout component):

```jsx
import RealTimeSyncBridge from './components/shared/RealTimeSyncBridge';

// Inside JSX tree (anywhere inside AuthProvider):
<RealTimeSyncBridge />
```

---

## Step 8: Add Vite Env Vars

Add these to your **`.env`** file (root of project). Vite only exposes vars prefixed `VITE_` to the browser.
The non-prefixed `PUSHER_*` vars are for Laravel (server-side) only — both sets are needed.

```env
# Laravel (server-side broadcasting)
BROADCAST_DRIVER=pusher
PUSHER_APP_ID=hrms-app
PUSHER_APP_KEY=hrms-key
PUSHER_APP_SECRET=hrms-secret
PUSHER_HOST=127.0.0.1
PUSHER_PORT=6001
PUSHER_SCHEME=http
PUSHER_APP_CLUSTER=mt1

# Vite (browser-side Echo/Pusher — MUST have VITE_ prefix)
VITE_PUSHER_APP_KEY=hrms-key
VITE_PUSHER_HOST=127.0.0.1
VITE_PUSHER_PORT=6001
VITE_PUSHER_SCHEME=http
```

> **Rule:** If a var is read via `import.meta.env.*` in JS → needs `VITE_` prefix.  
> If read via `env()` in PHP → no prefix needed.

---

---

## Stale Key Versioning

**Already implemented** in `store/dataStore.js`. No changes needed at call sites.

### How it works

The `_baseKey()` function strips any `:vN` suffix before using a key as a flag or listener:

```javascript
_baseKey('admin_purchases:v2') // → 'admin_purchases'
_baseKey('admin_purchases')    // → 'admin_purchases' (unchanged)
```

This means:
- `markStale('admin_purchases:v2')` fires the same listener as `markStale('admin_purchases')`
- `useSilentRefresh('admin_purchases')` responds to both — **no consumer changes needed**
- The version in the key is purely informational — it signals to the **backend** that payload shape changed

### When to bump a version

Bump the version on the **server-sent stale key** (in your `DataMutated` event's `staleKeys` array) when:
- You change the JSON shape of an API response and old cached data would cause UI errors
- You need all clients (even those mid-session) to discard cached state and re-fetch fresh data

```php
// Old — consumers had cached the previous shape
staleKeys: ['admin_purchases']

// After a breaking API change — bump to :v2
staleKeys: ['admin_purchases:v2']
```

The frontend strips `:v2` and triggers the same `useSilentRefresh` re-fetch — **no frontend deploy needed**.

### Global version constant

`STALE_KEY_VERSION = 'v1'` is exported from `dataStore.js`. Use it when constructing versioned keys
in the backend `DataMutated` event if you want a single source of truth (sync manually between PHP and JS).

---

## Legacy Code to Remove After Implementation

| Item | File | Reason |
|---|---|---|
| `BroadcastChannel` block (lines 43–60) | `store/dataStore.js` | Replaced by WebSocket — keep only if same-tab sync without WS is desired as fallback |
| `document.addEventListener('orderPlaced', ...)` | `components/customer-portal/CustomerHome.js` | Replace with WS-triggered markStale |
| `params._t = Date.now()` cache-buster | `components/inventory/StockTab.js` | WS push makes this unnecessary |
| `visibilitychange` handler | `hooks/useSilentRefresh.js` | Optional: keep as offline fallback |

---

## Security Best Practices

1. **Always use `PrivateChannel`** for user-scoped data (orders, cart, notifications)
2. **Never broadcast model payloads** — only `stale_keys[]` + `event_type`; client re-fetches
3. **No echo-back loops** — local `markStale()` fires immediately; WS fires for all other devices. `markStale` is idempotent so double-firing is safe
4. **Queue broadcasts** — add `implements ShouldQueue` to `DataMutated` for fast controller responses
5. **Rate-limit location events** — throttle `RiderLocationUpdated` to 1 event per 2 seconds per rider

---

## Bugs Fixed During Audit

| File | Line | Bug | Fix |
|---|---|---|---|
| `components/users/Users.js` | 102 | `markStale('admin_users')` raw string | Changed to `markStale(STALE_KEYS.ADMIN_USERS)` ✅ Fixed |
| `config/broadcasting.php` | 18 | `BROADCAST_DRIVER=null` disables existing `RiderLocationUpdated` event | Set to `pusher` after Step 1 |
