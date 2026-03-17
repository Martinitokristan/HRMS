<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\DeliveryController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\RiderController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\SupplierAuthController;
use App\Http\Controllers\SupplierProductController;



// Auth (public)
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Supplier Auth (public)
Route::post('/supplier/auth/register', [SupplierAuthController::class, 'register']);
Route::post('/supplier/auth/login', [SupplierAuthController::class, 'login']);
Route::post('/supplier/auth/verify-email', [SupplierAuthController::class, 'verifyEmail']);

// Public Products & Categories
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{id}', [ProductController::class, 'show']);
Route::get('/categories', [CategoryController::class, 'index']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Products (Protected CUD) & Inventory
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::post('/inventory/transfer', [InventoryController::class, 'transferToStore']);
    Route::post('/categories', [CategoryController::class, 'store']);

    // Suppliers & Unit Types
    Route::apiResource('suppliers', SupplierController::class);
    Route::get('/unit-types', [\App\Http\Controllers\UnitTypeController::class, 'index']);

    Route::get('/sales/summary', [SaleController::class, 'summary']);
    Route::get('/sales', [SaleController::class, 'index']);
    Route::post('/sales', [SaleController::class, 'store']);
    Route::get('/sales/{id}', [SaleController::class, 'show']);
    Route::put('/sales/{id}/status', [SaleController::class, 'updateStatus']);
    Route::post('/sales/{id}/return', [SaleController::class, 'processReturn']);

    // Purchase Orders
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store']);
    Route::get('/purchase-orders/{id}', [PurchaseOrderController::class, 'show']);
    Route::post('/purchase-orders/{id}/approve', [PurchaseOrderController::class, 'approve']);
    Route::post('/purchase-orders/{id}/decline', [PurchaseOrderController::class, 'decline']);
    Route::post('/purchase-orders/{id}/receive', [PurchaseOrderController::class, 'markReceived']);

    // Deliveries
    Route::get('/deliveries', [DeliveryController::class, 'index']);
    Route::get('/deliveries/{id}', [DeliveryController::class, 'show']);
    Route::put('/deliveries/{id}/assign', [DeliveryController::class, 'assignRider']);
    Route::put('/deliveries/{id}/status', [DeliveryController::class, 'updateStatus']);
    Route::post('/deliveries/{id}/rate', [DeliveryController::class, 'submitRating']);
    Route::post('/deliveries/{id}/upload-proof', [DeliveryController::class, 'uploadProof']);
    Route::delete('/deliveries/{id}', [DeliveryController::class, 'destroy']);

    // Reports
    Route::get('/reports/sales', [ReportController::class, 'sales']);
    Route::get('/reports/inventory', [ReportController::class, 'inventory']);
    Route::get('/reports/top-products', [ReportController::class, 'topProducts']);
    Route::get('/reports/export', [ReportController::class, 'export']);

    // Users
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::put('/users/{id}/suspend', [UserController::class, 'suspend']);
    Route::put('/users/{id}/restore', [UserController::class, 'restore']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // Customers
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::get('/customer/orders', [CustomerController::class, 'myOrders']);
    Route::get('/customer/profile', [CustomerController::class, 'myProfile']);
    Route::put('/customer/profile', [CustomerController::class, 'updateProfile']);
    Route::post('/customer/orders/{id}/cancel', [SaleController::class, 'cancelOrder']);

    // Riders
    Route::get('/riders', [RiderController::class, 'index']);
    Route::get('/riders/me/dashboard', [RiderController::class, 'dashboard']);
    Route::get('/riders/me/deliveries', [RiderController::class, 'myDeliveries']);
    Route::post('/riders/me/toggle-status', [RiderController::class, 'toggleStatus']);
    Route::get('/riders/available', [RiderController::class, 'availableRiders']);
    Route::get('/riders/{id}/stats', [RiderController::class, 'stats']);
    Route::post('/riders/{id}/interview', [RiderController::class, 'scheduleInterview']);
    Route::post('/riders/{id}/approve', [RiderController::class, 'approveRider']);
    Route::put('/riders/me/profile', [RiderController::class, 'updateProfile']);
    Route::post('/riders/me/photo', [RiderController::class, 'updatePhoto']);
    Route::put('/riders/me/security', [RiderController::class, 'updateSecurity']);
    Route::get('/riders/me/notifications', [RiderController::class, 'getNotifications']);
    Route::post('/riders/me/notifications/read', [RiderController::class, 'markNotificationsRead']);

    // Rider proximity notification
    Route::post('/deliveries/{id}/proximity', [DeliveryController::class, 'riderProximityUpdate']);

    // Customer notifications (polling)
    Route::get('/customer/notifications', [DeliveryController::class, 'customerNotifications']);
    Route::post('/customer/notifications/read', [DeliveryController::class, 'markNotificationsRead']);

    // Settings
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings', [SettingsController::class, 'update']);
    Route::post('/settings/variant-types', [SettingsController::class, 'saveVariantType']);
    Route::delete('/settings/variant-types/{id}', [SettingsController::class, 'deleteVariantType']);
    Route::post('/settings/variant-values', [SettingsController::class, 'saveVariantValue']);
    Route::delete('/settings/variant-values/{id}', [SettingsController::class, 'deleteVariantValue']);
    Route::get('/settings/unit-types', [SettingsController::class, 'getUnitTypes']); // Optional, index has it
    Route::post('/settings/unit-types', [SettingsController::class, 'saveUnitType']);
    Route::delete('/settings/unit-types/{id}', [SettingsController::class, 'deleteUnitType']);
    Route::post('/settings/unit-conversions', [SettingsController::class, 'saveUnitConversion']);
    Route::delete('/settings/unit-conversions/{id}', [SettingsController::class, 'deleteUnitConversion']);
    
    // Category Management in Settings
    Route::post('/settings/categories', [SettingsController::class, 'saveCategory']);
    Route::delete('/settings/categories/{id}', [SettingsController::class, 'deleteCategory']);

    // Notifications
    Route::get('/notifications', [SettingsController::class, 'getNotifications']);
    Route::post('/notifications/mark-all-read', [SettingsController::class, 'markAllNotificationsRead']);

    // Admin: Supplier Product Catalog (view supplier promoted products)
    Route::get('/supplier-catalog', [SupplierProductController::class, 'adminIndex']);
    Route::get('/supplier-catalog/{id}', [SupplierProductController::class, 'adminShow']);
});

// Supplier Protected Routes (outside auth:sanctum - uses supplier token auth)
Route::middleware('supplier.auth')->group(function () {
    Route::post('/supplier/auth/logout', [SupplierAuthController::class, 'logout']);
    Route::get('/supplier/auth/profile', [SupplierAuthController::class, 'profile']);
    Route::put('/supplier/auth/profile', [SupplierAuthController::class, 'updateProfile']);
    Route::get('/supplier/purchase-orders', [PurchaseOrderController::class, 'supplierIndex']);
    Route::get('/supplier/purchase-orders/{id}', [PurchaseOrderController::class, 'supplierShow']);
    Route::post('/supplier/purchase-orders/{id}/accept', [PurchaseOrderController::class, 'accept']);
    Route::post('/supplier/purchase-orders/{id}/reject', [PurchaseOrderController::class, 'reject']);
    Route::post('/supplier/purchase-orders/{id}/deliver', [PurchaseOrderController::class, 'deliver']);

    // Supplier Products (CRUD)
    Route::get('/supplier/products', [SupplierProductController::class, 'index']);
    Route::post('/supplier/products', [SupplierProductController::class, 'store']);
    Route::put('/supplier/products/{id}', [SupplierProductController::class, 'update']);
    Route::delete('/supplier/products/{id}', [SupplierProductController::class, 'destroy']);

    // Supplier access to categories
    Route::get('/supplier/categories', [\App\Http\Controllers\CategoryController::class, 'index']);
});
