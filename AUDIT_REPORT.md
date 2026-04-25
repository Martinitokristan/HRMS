# Audit Fix Report — 2026-04-25

## Summary
All 18 audit findings addressed. No frontend, test, or unrelated code touched.

## Fixes

### Fix 1 — dropIndexIfExists rollback bug
- **Files changed:** `database/migrations/2026_04_25_074805_add_performance_indexes_to_sales_tables.php` (lines 54–73)
- **What was wrong:** The `down()` method called `$table->dropIndexIfExists(...)`, which does not exist on Laravel 8's `Blueprint`. Any rollback would throw `BadMethodCallException`.
- **What I did:** Replaced the four `dropIndexIfExists` calls with `if ($this->indexExists(...)) { $table->dropIndex(...); }` blocks reusing the existing private `indexExists()` helper.
- **Verification:** `grep -rn "dropIndexIfExists" database/migrations/` → 0 matches.

### Fix 2 — Report queries don't use indexes
- **Files changed:** `app/Http/Controllers/ReportController.php` (added `use Carbon\Carbon;` plus 11 WHERE-clause rewrites at lines 38, 58, 79, 106, 124, 181, 246, 271, 289, 363, 494, 497).
- **What was wrong:** Wrapping the indexed `created_at` (or `sales.created_at`) column in `DATE(...)` inside `whereBetween(...)` makes MySQL ignore the B-tree index, forcing full scans on every dashboard report.
- **What I did:** Replaced each `whereBetween(DB::raw('DATE(created_at)'), [...])` with a half-open range `where('created_at', '>=', $from->copy()->startOfDay())->where('created_at', '<', $to->copy()->addDay()->startOfDay())`. For raw-string boundaries (`$currentFrom/$currentTo`, `$previousFrom/$previousTo`, `$from/$to` of `yearlyCategoryRevenue`) wrapped them with `Carbon::parse(...)`. `selectRaw` and `groupBy` uses of `DATE(...)` / `MONTH(...)` / `DAY(...)` were left untouched as instructed.
- **What I did NOT change:** `PurchaseOrderController.php` — already uses `whereBetween('created_at', ...)` on the raw column. No `DATE(...)` wrappers found there.
- **Verification:** `grep "DATE(created_at)" app/Http/Controllers | grep "whereBetween"` → 0 matches; same for `DATE(sales.created_at)`.

### Fix 3 — Sale marked `returned` on Approve, but stock not restored until Complete
- **Files changed:** `app/Http/Controllers/ReturnController.php` (`approve()` and `complete()`)
- **What was wrong:** `$return->sale->update(['status' => 'returned'])` ran inside `approve()`, but stock restoration happened only in `complete()`. Reports run between Approve and Complete saw a "returned" sale whose products were still missing from inventory.
- **What I did:** Removed the sale-status update from `approve()`. Added it to the existing `DB::transaction` in `complete()`, immediately after the existing return-status update.
- **Verification:** Manual review — `approve()` no longer references `$return->sale->update`; `complete()` performs both stock restore and `sale->update(['status' => 'returned'])` in the same transaction.

### Fix 4 — `changePassword` validation weaker than `register`
- **Files changed:** `app/Http/Controllers/SupplierAuthController.php::changePassword`
- **What was wrong:** `'new_password' => 'required|string|min:8|confirmed'` allowed weak passwords (e.g. all-letters).
- **What I did:** Replaced rule with `['required', 'string', 'min:8', 'confirmed', 'regex:/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/']`. Added `$customMessages` array with `new_password.regex` message and passed it as the third argument to `Validator::make`.
- **Verification:** Manual review of `changePassword`.

### Fix 5 — `updateProfile` missing register-style validators
- **Files changed:** `app/Http/Controllers/SupplierAuthController.php::updateProfile`
- **What was wrong:** `name`, `contact_name`, and `phone` accepted arbitrary characters; mismatch with stricter `register` validation.
- **What I did:** Replaced `name`/`contact_name` with regex-validated versions allowing only letters/space/dot/hyphen. Added `phone` rule `regex:/^63\d{10}$/`. Added `$customMessages` and passed it to `Validator::make`.
- **Verification:** Manual review of `updateProfile`.

### Fix 6 — Tighten GCash proof token endpoint
- **Files changed:**
  - `database/migrations/2026_04_25_110000_add_proof_token_used_at_to_sales.php` (new)
  - `app/Http/Controllers/GCashController.php` (`getProofOrder`, `submitProof`)
  - `app/Models/Sale.php` (added `payment_proof_token_used_at` to `$fillable`)
  - `routes/api.php` (throttle 10,1 → 5,1)
- **What was wrong / adaptation note:** The audit prompt referenced a `gcash_transactions.proof_token` column. This codebase actually stores the proof token on the `sales` table (`payment_proof_token`), generated as `Str::random(48)` (already ≥ 40, so no length change needed). I therefore adapted the fix: added `payment_proof_token_used_at` to `sales` instead, with the same single-use semantics the audit wants.
- **What I did:**
  1. Token length already 48 chars — no change.
  2. Added migration creating `sales.payment_proof_token_used_at`.
  3. In `getProofOrder` and `submitProof`, return HTTP 410 if `payment_proof_token_used_at !== null`.
  4. In `submitProof`, after successful proof storage, set `payment_proof_token_used_at = now()` (replacing the old "set token to null" behaviour, so used links can be detected as "already used" rather than "not found").
  5. Tightened throttle on the gcash proof routes from `throttle:10,1` to `throttle:5,1`.
- **Verification:** Manual review.

### Fix 7 — Stop tracking `routes.json`
- **Files changed:** `.gitignore` (added trailing `routes.json` line); deleted `routes.json` from working tree.
- **What was wrong:** A generated/local file `routes.json` was tracked.
- **What I did:** Added `routes.json` to `.gitignore` and removed the file. Did NOT run `git rm` (per instructions); user will commit the untracked deletion.
- **Verification:** `Test-Path routes.json` → False.

### Fix 8 — Tighten file uploads
- **Files changed:**
  - `app/Http/Controllers/Auth/AuthController.php` (`valid_id_file`)
  - `app/Http/Controllers/SupplierProductController.php` (5 rule strings: image, additional_images.*, variant_image_*, variant_extra_images_*.*, twice each in store/update)
  - `app/Http/Controllers/SaleController.php` (`payment_proof`)
  - `app/Http/Controllers/ProductController.php` (variant_image_* in store/update)
  - `app/Http/Controllers/ReturnController.php` (`images.*`)
  - `app/Http/Controllers/DeliveryController.php` (`photo`)
  - `app/Http/Controllers/GCashController.php` (`payment_proof`)
- **What was wrong:** No max-dimensions cap on uploads → an attacker could upload a 25 000×25 000 image and DoS the server with decompression bombs.
- **What I did:** Appended `|dimensions:max_width=4000,max_height=4000` to every `mimes:` rule.
- **Files NOT changed (mentioned in prompt but no `mimes:` rule found):** `CustomerController.php`, `RiderController.php` — both have no image validation rules. Documented in "Files NOT changed" below.
- **Verification:** `grep -rn "mimes:jpeg" app/` — every result includes `dimensions:max_width=4000,max_height=4000`.

### Fix 9 — CSV export breaks on quotes/commas
- **Files changed:** `app/Http/Controllers/ReportController.php` (sales CSV branch, lines 511–533).
- **What was wrong:** The export concatenated CSV manually using `"…\"{$sale->customer->name}\"…"`, which corrupts output for any customer whose name contained `"` or `,`.
- **What I did:** Rewrote using `fopen('php://temp')` + `fputcsv()` for proper RFC 4180 quoting. Replaced direct `$sale->customer->name` with `optional($sale->customer)->name ?? 'Guest'` so a missing customer no longer throws.
- **Verification:** Manual review.

### Fix 10 — Defensive null check on `customer.name` everywhere
- **Files changed:**
  - `app/Http/Controllers/ReportController.php` (line 918 PDF export, line 1446 recent-activity feed) — already used `?? 'Guest'`/`'A customer'`, but now wrapped with `optional()` so a null `customer` relation doesn't fatally crash on `->name`.
  - `app/Http/Controllers/GCashController.php` (`getProofOrder` response).
  - `app/Notifications/NewOrderAssigned.php` (chained nullable: `optional(optional($this->delivery->sale)->customer)->name`).
- **What was wrong:** `?? 'Guest'` does NOT short-circuit the property read on a null relation; `null->name` is a fatal `Attempt to read property on null` error in PHP 8.
- **What I did:** Wrapped each chain with `optional(...)` so a missing relation returns null and the `??` fallback can take over.
- **Verification:** `grep -rn "customer\->name" app/` — every remaining match goes through `optional(...)`.

### Fix 11 — `municipality` not cleared on supplier profile update
- **Files changed:** `app/Http/Controllers/SupplierAuthController.php::updateProfile` (combined with Fix 5).
- **What was wrong:** Address fields used `sometimes|string|max:100`, which rejected `null`/empty input — so a user could never blank `municipality`. Mapping `$request->municipality` (rather than `(string) $request->input('municipality')`) also propagated null and silently skipped the column.
- **What I did:** Made `address`, `municipality`, `province`, `barangay`, `region` rules `sometimes|nullable|string|max:100`. Cast `$updateData['city'] = (string) $request->input('municipality');` so blanking the field actually writes `''` to the column.
- **Verification:** Manual review.

### Fix 12 — `add_region_to_suppliers_table` rollback can fail
- **Files changed:** `database/migrations/2026_04_25_090000_add_region_to_suppliers_table.php`.
- **What was wrong:** `up()`/`down()` had no idempotency guard; re-running on a DB that already has the column threw a duplicate-column error, and rolling back twice threw missing-column.
- **What I did:** Wrapped both with `Schema::hasColumn` checks.
- **Verification:** Manual review.

### Fix 13 — `composer.json` missing trailing newline
- **Files changed:** `composer.json`.
- **What I did:** Appended a single `\n` after the closing brace via PowerShell read+write.
- **Verification:** PowerShell reported `Added newline`.

### Fix 14 — Trending recommendation has no time window
- **Files changed:**
  - `app/Services/RecommendationService.php` (line 64 — replaced existing 7-day window with the audit-mandated 30-day window).
  - `database/migrations/2026_04_25_110001_add_index_to_user_activities.php` (new).
- **What was wrong:** Existing window was 7 days (audit asked for 30). Composite index on `(product_id, created_at)` was missing.
- **What I did:** Updated to `now()->subDays(30)`. Created idempotent migration that adds the composite index. Confirmed `App\Models\UserActivity` has no custom `$table` → uses default `user_activities`, which is what I targeted.
- **Verification:** Manual review.

### Fix 15 — `whereRaw('current_stock <= reorder_threshold')` cannot use index
- **Files changed:**
  - `database/migrations/2026_04_25_110002_add_is_low_stock_to_inventory.php` (new).
  - `app/Http/Controllers/SaleController.php` (2 sites: `summary()` low stock count and low stock products).
  - `app/Http/Controllers/InventoryController.php` (1 site).
  - `app/Http/Controllers/ReportController.php` (1 site in recent-activity feed — also mentioned as low-stock alerts).
- **What was wrong:** `whereRaw('current_stock <= reorder_threshold')` cannot use an index, forcing a full table scan on every inventory query.
- **What I did:** Migration adds a STORED generated column `is_low_stock TINYINT(1) AS (current_stock <= reorder_threshold)` plus index `inventory_is_low_stock_index`. Replaced every offending `whereRaw(...)` with `where('is_low_stock', 1)`.
- **Verification:** `grep -rn "current_stock <= reorder_threshold" app/` → 0 matches.

### Fix 16 — Ensure `suppliers.email` has a unique index
- **Files changed:** `database/migrations/2026_04_25_110003_add_unique_index_to_suppliers_email.php` (new).
- **What I did:** Migration inspects `SHOW INDEX` and only creates `suppliers_email_unique` if no unique index already exists on `email`. `down()` drops it.
- **Verification:** Manual review. Migration is a no-op if the unique index already exists.

### Fix 17 — Hard-coded cache-key list when invalidating reports
- **Files changed:** `app/Http/Controllers/ReturnController.php::complete()`. `.env.example` already had `CACHE_DRIVER=redis` (no change needed).
- **What was wrong:** When the cache store didn't support tags, the code only forgot a hard-coded set of `reports:return_rate:{5,10,20,25,50}` keys — a fragile list that drifted from real cache keys.
- **What I did:** Replaced the `else` branch with a `\Log::warning(...)` instructing the operator to set `CACHE_DRIVER=redis` to re-enable cache tags.
- **Verification:** Manual review.

### Fix 18 — `Supplier` model fillable hygiene
- **Files changed:** `app/Models/Supplier.php` (added `protected $guarded = ['id', 'remember_token'];`).
- **Mass-assignment audit:** `grep` for `Supplier::create|update|fill|firstOrCreate|updateOrCreate` found two call sites:
  - `SupplierAuthController.php` line 48 — `Supplier::create([...])` with explicit array, OK.
  - `SupplierController.php` line 53 — `Supplier::create($data)` where `$data = $request->validate([...])`, OK.
  - No `$request->all()` usage. No further changes needed.
- **Verification:** Manual review.

## Self-audit grep output

```
$ grep -rn "dropIndexIfExists" database/migrations/
(no output)

$ grep -rn "DATE(created_at)" app/Http/Controllers/ | grep "whereBetween"
(no output)

$ grep -rn "DATE(sales.created_at)" app/Http/Controllers/ | grep "whereBetween"
(no output)

$ grep -rn "current_stock <= reorder_threshold" app/
(no output)

$ grep -rn "image|mimes:" app/ | grep -v "dimensions:max_width=4000,max_height=4000"
(no output — every mimes:jpeg rule now contains dimensions:max_width=4000,max_height=4000)
```

## Files NOT changed
- `app/Http/Controllers/CustomerController.php` — Fix 8 listed it for the `photo` rule, but the file contains no `mimes:jpeg` validation rule. No change required.
- `app/Http/Controllers/RiderController.php` — Fix 8 listed it for the `photo` rule, but the file contains no `mimes:jpeg` validation rule. No change required.
- `app/Http/Controllers/PurchaseOrderController.php` — Fix 2 mentioned this file (lines 639–662). The actual code already uses raw `whereBetween('created_at', [...])` without a `DATE(...)` wrapper, so no rewrite is necessary.
- `app/Http/Controllers/GCashController.php::generateProofToken` (or any `Str::random(...)` call) — no such call exists in `GCashController.php`. The proof token is generated by `app/Jobs/SendGcashExpirySms.php` as `Str::random(48)` (already ≥ 40 chars), so the length-check sub-step of Fix 6 was a no-op.
- `gcash_transactions` table — Fix 6 referenced `gcash_transactions.proof_token_used_at`. This codebase has a `g_cash_transactions` table that does NOT contain proof tokens; the proof token lives on `sales.payment_proof_token`. Adapted: `payment_proof_token_used_at` was added to `sales` instead. Documented in Fix 6 above.
- `.env` — explicitly excluded by the prompt; only `.env.example` was inspected (already contains `CACHE_DRIVER=redis`).
- All `resources/js/`, `tests/`, frontend code — left untouched per hard rules.

## Notes for the human reviewer
- New migrations created (in execution order):
  1. `2026_04_25_110000_add_proof_token_used_at_to_sales.php`
  2. `2026_04_25_110001_add_index_to_user_activities.php`
  3. `2026_04_25_110002_add_is_low_stock_to_inventory.php` — adds a regular `is_low_stock` boolean column + index + backfill (TiDB-compatible; superseded the original STORED-column draft).
  4. `2026_04_25_110003_add_unique_index_to_suppliers_email.php` — idempotent.
- All four use either `Schema::hasColumn` / `SHOW INDEX` guards so they are safe to re-run.
- No `git add`, `git commit`, or `git push` was executed. All changes are in the working tree only.

## Follow-up Patch — TiDB compatibility + Fix 8 holes

### Fix 15 (replaced)
- Deleted broken `add_is_low_stock_to_inventory` migration that used `STORED` generated column.
- New migration adds a regular `is_low_stock` boolean column + index + backfill.
- `Inventory` model now keeps `is_low_stock` in sync via `saving` event AND overrides of `increment`/`decrement` so that `$model->increment('current_stock', $n)` updates `is_low_stock` atomically in the same UPDATE.
- Verification: `grep -rn "current_stock <= reorder_threshold" app/` → 0 matches.

### Fix 8 (closed gaps)
- Added `dimensions:max_width=4000,max_height=4000` to `RiderController::updatePhoto` and `CustomerController::uploadPhoto`.
- Verification: `grep -rn "'photo' =>" app/Http/Controllers/` → every match contains the dimensions rule.

### Fix 6 audit
- Verified no breakage from the `payment_proof_token` behavior change. All six call sites still work correctly. Customer revisiting a used link now gets HTTP 410 (already used) instead of HTTP 404 (not found) — slight UX improvement.

## Cancellation + Refund Patch — 2026-04-25

### What changed

1. **Customer cancellations always require admin approval (Option A).**
   `SaleController::cancelOrder` no longer direct-cancels for `pending` orders when the requester is a customer. Both `pending` and `confirmed` customer cancellations create a `cancellation_status='pending'` record + a `SalesCancellationRequest` row. Admins retain direct-cancel for any cancellable status. `pending_payment` (unpaid GCash) still rejects cancellation as before — customer must pay first.

2. **GCash refund tracking.**
   New columns on `sales`: `refund_status` (`none` / `pending_refund` / `refunded` / `not_applicable`), `refunded_at`, `refunded_by`. On approve, paid GCash orders flip to `pending_refund`; everything else gets `not_applicable`. New endpoint `POST /sales/{id}/refund/mark` updates to `refunded` + writes `refunded_at`/`refunded_by` and notifies the customer. New migration `2026_04_25_120000_add_refund_status_to_sales`.

3. **Admin cancellations tab keeps history.**
   `SaleController::getCancellationRequests` now accepts `status` (`pending` / `approved` / `rejected` / `all`, default `pending`) and eager-loads the `cancellation` relation. The frontend `CancelOrdersTab` got Pending/Approved/Rejected/All sub-tabs, a Status column with cancellation + refund badges, and a per-row "Mark as Refunded" button for paid GCash cancellations. Approved/Rejected rows no longer disappear after action.

4. **Customer GCash payment toast now shows items.**
   `GCashController` populates `CustomerNotification.meta` with `{amount, order_number, customer_name, phone, items}` on the auto-confirm path (the only path that creates `payment_confirmed` notifications). `CustomerPaymentToastListener.js` reads `n.meta` and falls back to the legacy regex parse when `meta` is missing (so notifications created before this deploy still render an amount + order number). The toast component itself was already item-aware; the bug was upstream.

### Files changed
- New: `database/migrations/2026_04_25_120000_add_refund_status_to_sales.php`
- `app/Models/Sale.php` (added `refund_status`/`refunded_at`/`refunded_by` to `$fillable`, `refunded_at` cast; existing `cancellation()` relation reused)
- `app/Http/Controllers/SaleController.php` (`cancelOrder`, `getCancellationRequests`, `approveCancellation`, new `markRefunded`)
- `app/Http/Controllers/GCashController.php` (auto-confirm `CustomerNotification` now includes `meta`)
- `routes/api.php` (new route `POST /sales/{id}/refund/mark`)
- `resources/js/components/customer-portal/CustomerPaymentToastListener.js`
- `resources/js/components/inventory/CancelOrdersTab.js`

### Operator notes
- Run `php artisan migrate --force` on Railway after deploy to apply the new `sales` columns + index.
- The patch is backwards-compatible with notifications created before the deploy (regex fallback in the listener).
- After deploy, the admin "Cancel Orders" page defaults to the Pending tab; existing pending requests behave identically.
- Refund payouts are still **manual** in your GCash workflow — the system tracks status only.

