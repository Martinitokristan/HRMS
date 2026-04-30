# 401 Unauthorized Errors Investigation Report

**Date:** April 29, 2026  
**Status:** ROOT CAUSE IDENTIFIED ✅  
**Severity:** HIGH - Blocks API access for affected endpoints  
**Affected Controllers:** SettingsController, ReportController, PurchaseOrderController, RiderController, GCashController, SupplierProductController

---

## Executive Summary

The 401 (Unauthorized) errors are caused by **conflicting middleware at the route level and controller level**.

### Root Cause

Controllers have `$this->middleware('auth:sanctum')` in their constructors, which conflicts with the route-level `auth.token` middleware. These two middleware systems use different authentication methods:

- **`auth.token`** (route-level): Reads authentication from `auth_token` HttpOnly cookie via Sanctum
- **`auth:sanctum`** (controller-level): Expects Authorization header with Bearer token

When both run, the second one fails because typical API requests with HttpOnly cookies don't include Authorization headers.

---

## Failing Endpoints Analysis

| Endpoint                                   | Controller         | Method                | Route Middleware           | Constructor Middleware | Status         |
| ------------------------------------------ | ------------------ | --------------------- | -------------------------- | ---------------------- | -------------- |
| `GET /api/settings`                        | SettingsController | index                 | `auth.token`               | `auth:sanctum` ❌      | CONFLICT       |
| `GET /api/notifications`                   | SettingsController | getNotifications      | `auth.token`, `role:admin` | `auth:sanctum` ❌      | CONFLICT       |
| `GET /api/reports/yearly-category-revenue` | ReportController   | yearlyCategoryRevenue | `auth.token`, `role:admin` | `auth:sanctum` ❌      | CONFLICT       |
| `GET /api/reports/return-rate-by-category` | ReportController   | returnRateByCategory  | `auth.token`, `role:admin` | `auth:sanctum` ❌      | CONFLICT       |
| `GET /api/reports/recent-activity`         | ReportController   | recentActivity        | `auth.token`, `role:admin` | `auth:sanctum` ❌      | CONFLICT       |
| `GET /api/sales`                           | SaleController     | index                 | `auth.token`, `role:admin` | _(none)_               | ✅ SHOULD WORK |

---

## Detailed Findings

### 1. Controllers with Constructor Middleware (PROBLEMATIC)

These controllers have `$this->middleware('auth:sanctum')` in their `__construct` method, causing conflicts:

#### **SettingsController** - [app/Http/Controllers/SettingsController.php](app/Http/Controllers/SettingsController.php#L16)

```php
public function __construct()
{
    $this->middleware('auth:sanctum');  // LINE 16 ← REMOVE THIS
}
```

- **Affected Methods:** `index()`, `getNotifications()`
- **Failing Routes:**
    - `GET /api/settings` (line 86 in routes/api.php)
    - `GET /api/notifications` (line 189 in routes/api.php)

#### **ReportController** - [app/Http/Controllers/ReportController.php](app/Http/Controllers/ReportController.php#L13)

```php
public function __construct()
{
    $this->middleware('auth:sanctum');  // LINE 13 ← REMOVE THIS
}
```

- **Affected Methods:** All report methods
- **Failing Routes:**
    - `GET /api/reports/yearly-category-revenue` (line 137 in routes/api.php)
    - `GET /api/reports/return-rate-by-category` (line 138 in routes/api.php)
    - `GET /api/reports/recent-activity` (line 139 in routes/api.php)

#### **PurchaseOrderController** - [app/Http/Controllers/PurchaseOrderController.php](app/Http/Controllers/PurchaseOrderController.php#L18)

```php
public function __construct()
{
    $this->middleware('auth:sanctum');  // LINE 18 ← REMOVE THIS
}
```

- **Routes Affected:** All purchase order endpoints (admin-only)

#### **RiderController** - [app/Http/Controllers/RiderController.php](app/Http/Controllers/RiderController.php#L18)

```php
public function __construct()
{
    $this->middleware('auth:sanctum', ['except' => ['availableRiders', 'adminIndex', 'adminShow']]);  // LINE 18 ← REMOVE THIS
}
```

- **Routes Affected:** Rider endpoints (except the three listed)

#### **GCashController** - [app/Http/Controllers/GCashController.php](app/Http/Controllers/GCashController.php#L13)

```php
public function __construct()
{
    $this->middleware('auth:sanctum', ['except' => ['smsWebhook', 'getProofOrder', 'submitProof']]);  // LINE 13 ← REMOVE THIS
}
```

- **Routes Affected:** GCash endpoints (except the three listed which are public)

#### **SupplierProductController** - [app/Http/Controllers/SupplierProductController.php](app/Http/Controllers/SupplierProductController.php#L14)

```php
public function __construct()
{
    $this->middleware('auth:sanctum');  // LINE 14 ← REMOVE THIS
}
```

- **Routes Affected:** All supplier product endpoints

### 2. Controllers WITHOUT Constructor Middleware (CORRECT)

These controllers do NOT have conflicting middleware and should work correctly:

- **DeliveryController** - [app/Http/Controllers/DeliveryController.php](app/Http/Controllers/DeliveryController.php) - ✅ No constructor middleware
- **SaleController** - [app/Http/Controllers/SaleController.php](app/Http/Controllers/SaleController.php) - ✅ No constructor middleware (explains why `GET /api/sales` works)
- **InventoryController** - [app/Http/Controllers/InventoryController.php](app/Http/Controllers/InventoryController.php) - ✅ No constructor middleware

---

## Middleware Configuration Reference

### Route-Level Middleware (routes/api.php)

```php
// GROUP 1 — Shared All Roles
Route::middleware('auth.token')->group(function () {
    Route::get('/settings', [SettingsController::class , 'index']);
    // ✅ This works with auth.token middleware
});

// GROUP 2 — Admin Only
Route::middleware(['auth.token', 'role:admin'])->group(function () {
    Route::get('/sales', [SaleController::class , 'index']);        // ✅ Works (no constructor middleware)
    Route::get('/reports/yearly-category-revenue', [...]);          // ❌ Fails (has constructor middleware)
    // ... more routes
});
```

### Middleware Definition (app/Http/Kernel.php)

```php
'auth.token' => \App\Http\Middleware\AuthenticateHttpOnlyToken::class,
```

### AuthenticateHttpOnlyToken Middleware

**File:** [app/Http/Middleware/AuthenticateHttpOnlyToken.php](app/Http/Middleware/AuthenticateHttpOnlyToken.php)

This middleware:

1. Reads the `auth_token` HttpOnly cookie
2. Looks up the token in Sanctum's `personal_access_tokens` table
3. Resolves the user/supplier from the token's `tokenable` relationship
4. Sets `auth()->setUser($user)` for the request
5. Returns 401 if token not found or invalid

**Key Point:** It does NOT set an Authorization header or Bearer token.

---

## Why This Conflict Causes 401 Errors

### Middleware Execution Order

When a request hits `GET /api/settings`:

1. **Route Middleware** (`auth.token`):
    - Reads `auth_token` cookie ✅
    - Finds token in database ✅
    - Sets `auth()->user()` ✅
    - Passes to next middleware ✅

2. **Controller Constructor Middleware** (`auth:sanctum`):
    - Looks for Authorization header with Bearer token ❌
    - No Authorization header present (only cookie was sent) ❌
    - Returns 401 error ❌ **← THIS IS THE PROBLEM**

The request never reaches the controller method because the second middleware rejects it.

---

## Phase 1 Refactoring Context

According to the [PHASE_1A_1B_COMPLETION_REPORT.md](PHASE_1A_1B_COMPLETION_REPORT.md):

- **Phase 1A (DeliveryController)**: ✅ No constructor middleware added
- **Phase 1B (SaleController)**: ✅ No constructor middleware added
- **Phase 1D (ReportController)**: ❌ Has constructor middleware (introduced during refactoring)
- **Phase 1E (SettingsController)**: ❌ Has constructor middleware (introduced during refactoring)
- **Phase 1F (PurchaseOrderController)**: ❌ Has constructor middleware (introduced during refactoring)

The controllers without constructor middleware (Delivery, Sales) are working correctly.

---

## Required Fixes

### Fix 1: Remove Constructor Middleware from SettingsController

**File:** [app/Http/Controllers/SettingsController.php](app/Http/Controllers/SettingsController.php)  
**Line:** 16  
**Action:** Delete the entire `__construct` method

```php
// REMOVE THESE 5 LINES:
public function __construct()
{
    $this->middleware('auth:sanctum');
}
```

**Affected Endpoints:**

- ✅ `GET /api/settings`
- ✅ `GET /api/notifications`
- ✅ All other SettingsController methods

---

### Fix 2: Remove Constructor Middleware from ReportController

**File:** [app/Http/Controllers/ReportController.php](app/Http/Controllers/ReportController.php)  
**Line:** 13  
**Action:** Delete the entire `__construct` method

```php
// REMOVE THESE 5 LINES:
public function __construct()
{
    $this->middleware('auth:sanctum');
}
```

**Affected Endpoints:**

- ✅ `GET /api/reports/yearly-category-revenue`
- ✅ `GET /api/reports/return-rate-by-category`
- ✅ `GET /api/reports/recent-activity`
- ✅ All other report endpoints

---

### Fix 3: Remove Constructor Middleware from PurchaseOrderController

**File:** [app/Http/Controllers/PurchaseOrderController.php](app/Http/Controllers/PurchaseOrderController.php)  
**Line:** 18  
**Action:** Delete the entire `__construct` method

```php
// REMOVE THESE 5 LINES:
public function __construct()
{
    $this->middleware('auth:sanctum');
}
```

---

### Fix 4: Remove Constructor Middleware from RiderController

**File:** [app/Http/Controllers/RiderController.php](app/Http/Controllers/RiderController.php)  
**Line:** 18  
**Action:** Delete the entire `__construct` method

```php
// REMOVE THESE 5 LINES:
public function __construct()
{
    $this->middleware('auth:sanctum', ['except' => ['availableRiders', 'adminIndex', 'adminShow']]);
}
```

---

### Fix 5: Remove Constructor Middleware from GCashController

**File:** [app/Http/Controllers/GCashController.php](app/Http/Controllers/GCashController.php)  
**Line:** 13  
**Action:** Delete the entire `__construct` method

```php
// REMOVE THESE 5 LINES:
public function __construct()
{
    $this->middleware('auth:sanctum', ['except' => ['smsWebhook', 'getProofOrder', 'submitProof']]);
}
```

---

### Fix 6: Remove Constructor Middleware from SupplierProductController

**File:** [app/Http/Controllers/SupplierProductController.php](app/Http/Controllers/SupplierProductController.php)  
**Line:** 14  
**Action:** Delete the entire `__construct` method

```php
// REMOVE THESE 5 LINES:
public function __construct()
{
    $this->middleware('auth:sanctum');
}
```

---

## Why These Fixes Are Safe

✅ **Routes Already Handle Authentication**

- All affected endpoints are already protected by route-level `auth.token` middleware
- Removing controller-level middleware won't expose any endpoints

✅ **Authorization Logic Preserved**

- Role-based authorization (`role:admin`, `role:supplier`, etc.) happens at route level
- Service layer authorization is unchanged
- No security regression

✅ **Consistent with Working Controllers**

- DeliveryController, SaleController, InventoryController work correctly without constructor middleware
- These controllers also use services and require authentication
- Following the same pattern ensures consistency

✅ **Sanctum Still Used**

- The `auth.token` middleware uses Sanctum's token system
- We're not removing Sanctum, just the conflicting middleware

---

## Why These Were Likely Added During Refactoring

Possible scenarios:

1. **Copy-Paste Error**: When extracting service layer code, a developer may have copied controller template that included middleware

2. **Accidental Addition**: Middleware might have been added for other controllers first (like API testing), then not removed from refactored controllers

3. **Misunderstanding of Route Middleware**: A developer might not have realized that routes already handle middleware through route groups

4. **Incomplete Refactoring**: The refactoring process may have been interrupted, leaving half-updated controller middleware

---

## Pattern Consistency

### Controllers Created/Refactored in Phase 1 and Their Middleware Status

| Phase | Controller              | Refactored | Constructor Middleware | Route Middleware Works |
| ----- | ----------------------- | ---------- | ---------------------- | ---------------------- |
| 1A    | DeliveryController      | ✅ Yes     | ❌ None                | ✅ Yes                 |
| 1B    | SaleController          | ✅ Yes     | ❌ None                | ✅ Yes                 |
| 1C    | InventoryController     | ✅ Yes     | ❌ None                | ✅ Yes                 |
| 1D    | ReportController        | ✅ Yes     | ❌ `auth:sanctum`      | ❌ No                  |
| 1E    | SettingsController      | ✅ Yes     | ❌ `auth:sanctum`      | ❌ No                  |
| 1F    | PurchaseOrderController | ✅ Yes     | ❌ `auth:sanctum`      | ❌ No                  |

**Pattern:** Controllers from Phase 1A-C (no middleware) work fine. Controllers from Phase 1D-F (with middleware) fail.

---

## Verification Steps After Fixes

After removing the constructor middleware from all 6 controllers:

1. Test each failing endpoint with valid auth token in cookie:

    ```bash
    curl -H "Cookie: auth_token=<valid_token>" https://api/settings
    ```

2. Verify 401 returns correctly for unauthenticated requests (no cookie)

3. Verify 403 returns correctly for insufficient role (authenticated but not admin)

4. Run test suite if available

5. Monitor logs for any authentication-related errors

---

## No Changes Needed

✅ **routes/api.php** - Middleware configuration is correct  
✅ **app/Http/Kernel.php** - Middleware aliases are correct  
✅ **app/Http/Middleware/AuthenticateHttpOnlyToken.php** - Middleware implementation is correct  
✅ **app/Http/Middleware/EnsureRole.php** - Role checking is correct  
✅ **Service layer** - No changes needed  
✅ **Database** - No changes needed

---

## Summary of Changes Required

| File                          | Action        | Line  | Content to Remove                                                               |
| ----------------------------- | ------------- | ----- | ------------------------------------------------------------------------------- |
| SettingsController.php        | Delete method | 16-20 | `__construct() { $this->middleware('auth:sanctum'); }`                          |
| ReportController.php          | Delete method | 13-17 | `__construct() { $this->middleware('auth:sanctum'); }`                          |
| PurchaseOrderController.php   | Delete method | 18-22 | `__construct() { $this->middleware('auth:sanctum'); }`                          |
| RiderController.php           | Delete method | 18-22 | `__construct() { $this->middleware('auth:sanctum', [...exception array...]); }` |
| GCashController.php           | Delete method | 13-17 | `__construct() { $this->middleware('auth:sanctum', [...exception array...]); }` |
| SupplierProductController.php | Delete method | 14-18 | `__construct() { $this->middleware('auth:sanctum'); }`                          |

---

## Root Cause Category

**Middleware Conflict** - Route-level vs Controller-level authentication middleware using incompatible authentication methods (cookies vs. Authorization headers).
