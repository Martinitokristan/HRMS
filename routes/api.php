<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
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
use App\Http\Controllers\RouteController;
use App\Http\Controllers\ReturnController;

use App\Http\Controllers\ProductReviewController;
use App\Http\Controllers\GCashController;
use App\Http\Controllers\RecommendationController;
use App\Http\Controllers\BrandController;

// Auth (public)
Route::post('/auth/register', [AuthController::class , 'register']);
Route::middleware(['throttle:login'])->post('/login', LoginController::class);
Route::get('/auth/verify-email', [AuthController::class , 'verifyEmail']);
Route::post('/auth/resend-verification', [AuthController::class , 'resendVerification']);

// Password Reset (public — rate limited)
Route::middleware(['throttle:password.reset'])->group(function () {
    Route::post('/auth/forgot-password', [PasswordResetController::class , 'forgotPassword']);
    Route::post('/auth/reset-password', [PasswordResetController::class , 'resetPassword']);
});

// Supplier Auth (public)
Route::middleware(['throttle:login'])->group(function () {
    Route::post('/supplier/auth/login', [SupplierAuthController::class , 'login']);
});
Route::post('/supplier/auth/register', [SupplierAuthController::class , 'register']);
Route::get('/supplier/auth/verify-email', [SupplierAuthController::class , 'verifyEmail']);
Route::post('/supplier/auth/resend-verification', [SupplierAuthController::class , 'resendVerification']);

// Public Products & Categories
Route::get('/products', [ProductController::class , 'index']);
Route::get('/products/best-sellers', [ProductController::class , 'bestSellers']);
Route::get('/products/{id}', [ProductController::class , 'show']);
Route::get('/categories', [CategoryController::class , 'index']);

// Public Product Reviews
Route::get('/products/{id}/reviews', [ProductReviewController::class , 'productReviews']);
Route::get('/products/{id}/sold-count', [ProductReviewController::class , 'soldCount']);
Route::get('/reviews/public', [ProductReviewController::class , 'publicReviews']);

// Route API proxy (public - no auth needed)
Route::middleware(['throttle:60,1'])->post('/route', [RouteController::class , 'getRoute']);

// GCash Public Webhook (No Auth - SMS Forwarder)
Route::middleware(['throttle:30,1'])->post('/gcash/sms-webhook', [GCashController::class, 'smsWebhook']);

// GCash Proof Submission (No Auth - Token-based link from SMS)
Route::middleware(['throttle:5,1'])->group(function () {
    Route::get('/gcash/proof/{token}',  [GCashController::class, 'getProofOrder']);
    Route::post('/gcash/proof/{token}', [GCashController::class, 'submitProof']);
});

// Test route
Route::get('/test', function () {
    return response()->json(['message' => 'Route works!']);
});

// =========================================================================
// GROUP 1 — Shared All Roles (auth:sanctum, no role restriction)
// =========================================================================
Route::middleware('auth.token')->group(function () {
    Route::post('/logout', LogoutController::class);
    Route::get('/me', MeController::class);
    Route::get('/settings', [SettingsController::class , 'index']);
});

// =========================================================================
// GROUP 2 — Admin Only
// =========================================================================
Route::middleware(['auth.token', 'role:admin'])->group(function () {
    // Products CUD
    Route::post('/products', [ProductController::class , 'store']);
    Route::put('/products/{id}', [ProductController::class , 'update']);
    Route::delete('/products/{id}', [ProductController::class , 'destroy']);
    // Inventory
    Route::get('/inventory', [InventoryController::class , 'index']);
    Route::post('/inventory/transfer', [InventoryController::class , 'transferToStore']);
    Route::post('/inventory/transfer-multiple', [InventoryController::class , 'transferMultipleToStore']);
    Route::get('/inventory/test/{productId}', [InventoryController::class , 'testInventoryState']);
    // Categories (admin create)
    Route::post('/categories', [CategoryController::class , 'store']);
    // Suppliers
    Route::apiResource('suppliers', SupplierController::class);
    Route::get('/unit-types', [\App\Http\Controllers\UnitTypeController::class , 'index']);
    // Sales (admin operations)
    Route::get('/sales/summary', [SaleController::class , 'summary']);
    Route::get('/sales/cancellations', [SaleController::class , 'getCancellationRequests']);
    Route::post('/sales/{id}/cancellation/approve', [SaleController::class , 'approveCancellation']);
    Route::post('/sales/{id}/cancellation/reject', [SaleController::class , 'rejectCancellation']);
    Route::post('/sales/{id}/refund/mark', [SaleController::class , 'markRefunded']);
    Route::get('/sales', [SaleController::class , 'index']);
    Route::put('/sales/{id}/status', [SaleController::class , 'updateStatus']);
    Route::post('/sales/{id}/return', [SaleController::class , 'processReturn']);
    // Returns Management
    Route::get('/returns', [ReturnController::class , 'index']);
    Route::get('/returns/{id}', [ReturnController::class , 'show']);
    Route::post('/returns/{id}/approve', [ReturnController::class , 'approve']);
    Route::post('/returns/{id}/reject', [ReturnController::class , 'reject']);
    Route::post('/returns/{id}/complete', [ReturnController::class , 'complete']);
    // Purchase Orders
    Route::get('/purchase-orders', [PurchaseOrderController::class , 'index']);
    Route::post('/purchase-orders', [PurchaseOrderController::class , 'store']);
    Route::get('/purchase-orders/{id}', [PurchaseOrderController::class , 'show']);
    Route::post('/purchase-orders/{id}/approve', [PurchaseOrderController::class , 'approve']);
    Route::post('/purchase-orders/{id}/decline', [PurchaseOrderController::class , 'decline']);
    Route::post('/purchase-orders/{id}/receive', [PurchaseOrderController::class , 'markReceived']);
    // Deliveries (admin only)
    Route::put('/deliveries/{id}/assign', [DeliveryController::class , 'assignRider']);
    Route::delete('/deliveries/{id}', [DeliveryController::class , 'destroy']);
    // Reports
    Route::get('/reports/sales', [ReportController::class , 'sales']);
    Route::get('/reports/inventory', [ReportController::class , 'inventory']);
    Route::get('/reports/top-products', [ReportController::class , 'topProducts']);
    Route::get('/reports/category-sales', [ReportController::class , 'categorySales']);
    Route::get('/reports/yearly-category-revenue', [ReportController::class , 'yearlyCategoryRevenue']);
    Route::get('/reports/return-rate-by-category', [ReportController::class , 'returnRateByCategory']);
    Route::get('/reports/recent-activity', [ReportController::class , 'recentActivity']);
    Route::get('/reports/export', [ReportController::class , 'export']);
    Route::get('/reports/rating-analytics', [ReportController::class , 'ratingAnalytics']);
    Route::get('/reports/rating-analytics/rankings', [ReportController::class , 'ratingAnalyticsRankings']);
    Route::get('/reports/rating-analytics/feedback', [ReportController::class , 'ratingAnalyticsFeedback']);
    // Analytics
    Route::get('/analytics/customer-behavior', [ReportController::class , 'customerBehavior']);
    Route::get('/analytics/inventory-forecast', [ReportController::class , 'inventoryForecast']);
    Route::get('/analytics/profit-margins', [ReportController::class , 'profitMargins']);
    // GCash Logs
    Route::get('/gcash-logs', [GCashController::class, 'index']);
    // Users
    Route::get('/users', [UserController::class , 'index']);
    Route::put('/users/{id}', [UserController::class , 'update']);
    Route::put('/users/{id}/restore', [UserController::class , 'restore']);
    Route::delete('/users/{id}', [UserController::class , 'destroy']);
    // Customers (admin list)
    Route::get('/customers', [CustomerController::class , 'index']);
    // Riders (admin management)
    Route::get('/riders', [RiderController::class , 'index']);
    Route::get('/riders/available', [RiderController::class , 'availableRiders']);
    Route::get('/riders/{id}/stats', [RiderController::class , 'stats']);
    Route::post('/riders/{id}/interview', [RiderController::class , 'scheduleInterview']);
    Route::post('/riders/{id}/approve', [RiderController::class , 'approveRider']);
    // Settings (write operations)
    Route::put('/settings', [SettingsController::class , 'update']);
    Route::post('/settings/variant-types', [SettingsController::class , 'saveVariantType']);
    Route::delete('/settings/variant-types/{id}', [SettingsController::class , 'deleteVariantType']);
    Route::post('/settings/variant-values', [SettingsController::class , 'saveVariantValue']);
    Route::put('/settings/variant-values/{id}', [SettingsController::class , 'updateVariantValue']);
    Route::delete('/settings/variant-values/{id}', [SettingsController::class , 'deleteVariantValue']);

    // === Admin: variant attribute TYPES (Add/Rename/Delete from UI) ===
    Route::get('/admin/variants',                 [SettingsController::class, 'listVariantTypes']);
    Route::post('/admin/variants',                [SettingsController::class, 'storeVariantType']);
    Route::put('/admin/variants/{id}',            [SettingsController::class, 'updateVariantType']);
    Route::delete('/admin/variants/{id}',         [SettingsController::class, 'deleteVariantType']);

    // === Admin: category ↔ attribute type mapping ===
    Route::get('/admin/category-variant-types',   [SettingsController::class, 'listCategoryVariantTypes']);
    Route::post('/admin/category-variant-types',  [SettingsController::class, 'storeCategoryVariantType']);
    Route::delete('/admin/category-variant-types/{id}', [SettingsController::class, 'deleteCategoryVariantType']);
    Route::get('/settings/unit-types', [SettingsController::class , 'getUnitTypes']);
    Route::post('/settings/unit-types', [SettingsController::class , 'saveUnitType']);
    Route::delete('/settings/unit-types/{id}', [SettingsController::class , 'deleteUnitType']);
    Route::post('/settings/unit-conversions', [SettingsController::class , 'saveUnitConversion']);
    Route::delete('/settings/unit-conversions/{id}', [SettingsController::class , 'deleteUnitConversion']);
    Route::post('/settings/categories', [SettingsController::class , 'saveCategory']);
    Route::delete('/settings/categories/{id}', [SettingsController::class , 'deleteCategory']);
    // Notifications (admin)
    Route::get('/notifications', [SettingsController::class , 'getNotifications']);
    Route::post('/notifications/mark-all-read', [SettingsController::class , 'markAllNotificationsRead']);
    Route::delete('/notifications/{id}', [SettingsController::class , 'deleteNotification']);
    Route::post('/notifications/delete-batch', [SettingsController::class , 'deleteBatchNotifications']);
    Route::post('/notifications/delete-all', [SettingsController::class , 'deleteAllNotifications']);
    // Brands (admin — view all brands)
    Route::get('/brands', [BrandController::class, 'adminIndex']);
    // Supplier Catalog (admin views)
    Route::get('/supplier-catalog', [SupplierProductController::class , 'adminIndex']);
    Route::get('/supplier-catalog/{id}', [SupplierProductController::class , 'adminShow']);
    // Reviews (admin moderation)
    Route::get('/reviews', [ProductReviewController::class , 'index']);
    Route::delete('/reviews/{id}', [ProductReviewController::class , 'destroy']);
    // Wave 6 — Cash Remittance + Rider Payouts (admin only)
    Route::get('/admin/cash-remittance',                                       [\App\Http\Controllers\Admin\CashRemittanceController::class , 'index']);
    Route::post('/admin/cash-remittance/{rider}/{date}/mark-remitted',         [\App\Http\Controllers\Admin\CashRemittanceController::class , 'markRemitted']);
    Route::get('/admin/payouts',                                               [\App\Http\Controllers\Admin\RiderPayoutController::class , 'index']);
    Route::post('/admin/payouts/mark-paid',                                    [\App\Http\Controllers\Admin\RiderPayoutController::class , 'markPaid']);
    Route::post('/admin/payouts/release-hold',                                 [\App\Http\Controllers\Admin\RiderPayoutController::class , 'releaseHold']);
});

// =========================================================================
// GROUP 3 — Admin + Customer
// =========================================================================
Route::middleware(['auth.token', 'role:admin,customer'])->group(function () {
    Route::get('/sales/{id}', [SaleController::class , 'show']);
    Route::post('/sales/{id}/cancel', [SaleController::class , 'cancelOrder']);
    Route::post('/sales/{id}/cancel-pending-payment', [SaleController::class , 'cancelPendingPayment']);
});

// =========================================================================
// GROUP 4 — Admin + Rider
// =========================================================================
Route::middleware(['auth.token', 'role:admin,rider'])->group(function () {
    Route::get('/deliveries', [DeliveryController::class , 'index']);
    Route::get('/deliveries/{id}', [DeliveryController::class , 'show']);
    Route::match(['put', 'post'], '/deliveries/{id}/status', [DeliveryController::class , 'updateStatus']);
    Route::post('/deliveries/{id}/upload-proof', [DeliveryController::class , 'uploadProof']);
});

// =========================================================================
// GROUP 5 — Customer Only
// =========================================================================
Route::middleware(['auth.token', 'role:customer'])->group(function () {
    // Place orders
    Route::post('/sales', [SaleController::class , 'store']);
    Route::get('/gcash/status/{saleId}', [GCashController::class, 'checkStatus']);

    // Customer profile & orders
    Route::get('/customer/orders', [CustomerController::class , 'myOrders']);
    Route::get('/customer/profile', [CustomerController::class , 'myProfile']);
    Route::put('/customer/profile', [CustomerController::class , 'updateProfile']);
    Route::put('/customer/change-password', [CustomerController::class , 'changePassword']);
    Route::post('/customer/photo', [CustomerController::class , 'uploadPhoto']);
    Route::post('/customer/orders/{id}/cancel', [SaleController::class , 'cancelOrder']);
    Route::post('/customer/orders/{id}/upload-proof', [SaleController::class , 'uploadGCashProof']);
    Route::get('/customer/orders/{id}/cancellation-policy', [SaleController::class , 'cancellationPolicy']);
    Route::post('/customer/returns', [ReturnController::class , 'store']);
    Route::get('/customer/returns', [ReturnController::class , 'customerReturns']);
    // Recommendations & Activity
    Route::get('/recommendations', [RecommendationController::class , 'index']);
    Route::post('/activity', [RecommendationController::class , 'logActivity']);
    Route::post('/search-log', [RecommendationController::class , 'logSearch']);
    // Reviews (customer submit/vote)
    Route::post('/products/{id}/reviews', [ProductReviewController::class , 'store']);
    Route::post('/reviews/{id}/helpful', [ProductReviewController::class , 'markHelpful']);
    Route::get('/customers/{customerId}/can-review/{productId}', [ProductReviewController::class , 'checkEligibility']);
    // Customer notifications
    Route::get('/customer/notifications', [DeliveryController::class , 'customerNotifications']);
    Route::get('/customer/delivery/{id}/rider-location', [DeliveryController::class , 'getRiderLocation']);
    Route::post('/customer/notifications/read', [DeliveryController::class , 'markNotificationsRead']);
    Route::delete('/customer/notifications/{id}', [DeliveryController::class , 'deleteNotification']);
    Route::post('/customer/notifications/delete-batch', [DeliveryController::class , 'deleteBatchNotifications']);
    Route::post('/customer/notifications/delete-all', [DeliveryController::class , 'deleteAllNotifications']);
    // Rate delivery
    Route::post('/deliveries/{id}/rate', [DeliveryController::class , 'submitRating']);
    // Wave 6 — customer confirm / dispute receipt
    Route::post('/sales/{id}/customer-confirm-receipt', [DeliveryController::class , 'customerConfirmReceipt']);
    Route::post('/sales/{id}/customer-dispute-receipt', [DeliveryController::class , 'customerDisputeReceipt']);
});

// =========================================================================
// GROUP 6 — Rider Only
// =========================================================================
Route::middleware(['auth.token', 'role:rider'])->group(function () {
    Route::get('/riders/me/dashboard', [RiderController::class , 'dashboard']);
    Route::get('/riders/me/wallet',    [RiderController::class , 'wallet']);
    // Wave 8 — paginated, read-only delivery history
    Route::get('/riders/me/history',   [RiderController::class , 'history']);
    // Wave 7 — pause / resume an in-progress delivery
    Route::post('/deliveries/{id}/pause',  [DeliveryController::class , 'pauseDelivery']);
    Route::post('/deliveries/{id}/resume', [DeliveryController::class , 'resumeDelivery']);
    Route::get('/riders/me/deliveries', [RiderController::class , 'myDeliveries']);
    Route::post('/riders/me/toggle-status', [RiderController::class , 'toggleStatus']);
    Route::post('/riders/me/update-location', [RiderController::class , 'updateLocation']);
    Route::put('/riders/me/profile', [RiderController::class , 'updateProfile']);
    Route::post('/riders/me/photo', [RiderController::class , 'updatePhoto']);
    Route::put('/riders/me/security', [RiderController::class , 'updateSecurity']);
    Route::get('/riders/me/notifications', [RiderController::class , 'getNotifications']);
    Route::post('/riders/me/notifications/read', [RiderController::class , 'markNotificationsRead']);
    Route::delete('/riders/me/notifications/{id}', [RiderController::class , 'deleteNotification']);
    Route::post('/riders/me/notifications/delete-batch', [RiderController::class , 'deleteBatchNotifications']);
    Route::post('/riders/me/notifications/delete-all', [RiderController::class , 'deleteAllNotifications']);
    Route::get('/riders/me/rating-stats', [RiderController::class , 'getRatingStats']);
    // Rider delivery actions
    Route::post('/deliveries/{id}/self-assign', [DeliveryController::class , 'selfAssign']);
    Route::post('/deliveries/{id}/decline', [DeliveryController::class , 'declineOrder']);
    Route::post('/deliveries/{id}/location', [DeliveryController::class , 'updateLocation']);
    Route::get('/deliveries/active', [DeliveryController::class , 'getActiveDelivery']);
    Route::post('/deliveries/{id}/proof', [DeliveryController::class , 'uploadProof']);
    Route::post('/deliveries/{id}/proximity', [DeliveryController::class , 'riderProximityUpdate']);
});

// =========================================================================
// GROUP 7 — Supplier Only
// =========================================================================
Route::middleware(['auth.token', 'role:supplier'])->group(function () {
    Route::get('/supplier/auth/profile', [SupplierAuthController::class , 'profile']);
    Route::put('/supplier/auth/profile', [SupplierAuthController::class , 'updateProfile']);
    Route::put('/supplier/auth/change-password', [SupplierAuthController::class , 'changePassword']);
    Route::get('/supplier/purchase-orders', [PurchaseOrderController::class , 'supplierIndex']);
    Route::get('/supplier/purchase-orders/{id}', [PurchaseOrderController::class , 'supplierShow']);
    Route::post('/supplier/purchase-orders/{id}/accept', [PurchaseOrderController::class , 'accept']);
    Route::post('/supplier/purchase-orders/{id}/reject', [PurchaseOrderController::class , 'reject']);
    Route::post('/supplier/purchase-orders/{id}/deliver', [PurchaseOrderController::class , 'deliver']);
    Route::get('/supplier/reports/revenue', [PurchaseOrderController::class , 'revenueReport']);
    Route::get('/supplier/products', [SupplierProductController::class , 'index']);
    Route::post('/supplier/products', [SupplierProductController::class , 'store']);
    Route::put('/supplier/products/{id}', [SupplierProductController::class , 'update']);
    Route::delete('/supplier/products/{id}', [SupplierProductController::class , 'destroy']);
    Route::get('/supplier/categories', [CategoryController::class , 'index']);
    Route::post('/supplier/categories', [CategoryController::class , 'store']);
    Route::delete('/supplier/categories/{id}', [CategoryController::class , 'destroy']);
    Route::get('/supplier/variant-values', [SettingsController::class , 'getVariantValues']);
    Route::post('/supplier/variant-values', [SettingsController::class , 'storeVariantValue']);
    Route::put('/supplier/variant-values/{id}', [SettingsController::class , 'updateVariantValue']);
    Route::delete('/supplier/variant-values/{id}', [SettingsController::class , 'deleteVariantValue']);

    // === Supplier: read-only attribute types (so supplier form knows what to render per category) ===
    Route::get('/supplier/variants',              [SettingsController::class, 'listVariantTypes']);
    Route::get('/supplier/category-variant-types',[SettingsController::class, 'listCategoryVariantTypes']);
    Route::get('/supplier/unit-types', [SettingsController::class , 'getUnitTypes']);
    Route::post('/supplier/unit-types', [SettingsController::class , 'storeUnitType']);
    Route::delete('/supplier/unit-types/{id}', [SettingsController::class , 'deleteUnitType']);
    // Supplier Brands
    Route::get('/supplier/brands', [BrandController::class, 'index']);
    Route::post('/supplier/brands', [BrandController::class, 'store']);
    Route::put('/supplier/brands/{id}', [BrandController::class, 'update']);
    Route::delete('/supplier/brands/{id}', [BrandController::class, 'destroy']);
    // Supplier Notifications
    Route::get('/supplier/notifications', [SettingsController::class , 'getNotifications']);
    Route::post('/supplier/notifications/mark-all-read', [SettingsController::class , 'markAllNotificationsRead']);
    Route::delete('/supplier/notifications/{id}', [SettingsController::class , 'deleteNotification']);
    Route::post('/supplier/notifications/delete-batch', [SettingsController::class , 'deleteBatchNotifications']);
    Route::post('/supplier/notifications/delete-all', [SettingsController::class , 'deleteAllNotifications']);
});
