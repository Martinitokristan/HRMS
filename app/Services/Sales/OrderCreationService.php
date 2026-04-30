<?php

namespace App\Services\Sales;

use App\Events\DataMutated;
use App\Models\Sale;
use App\Models\Delivery;
use App\Models\Inventory;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderCreationService
{
    /**
     * Create a new sale order with stock deduction and delivery creation.
     */
    public function create($data, $user)
    {
        \Log::info('=== SALE STORE METHOD CALLED ===', []);
        \Log::info('New order received:', $data);

        $sale = DB::transaction(function () use ($data, $user) {
            $subtotal = 0;
            $itemsData = [];

            foreach ($data['items'] as $item) {
                $product = \App\Models\Product::findOrFail($item['product_id']);

                // Use provided price (from cart), or fall back to product price
                $unitPrice = $item['price'] ?? $product->sell_price;
                $lineTotal = $item['quantity'] * $unitPrice;
                $subtotal += $lineTotal;

                $itemsData[] = [
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'unit_price' => $unitPrice,
                    'subtotal' => $lineTotal,
                ];

                // Deduct stock
                if (!empty($item['product_variant_id'])) {
                    $this->deductVariantStock($product, $item);
                } else {
                    $this->deductProductStock($product, $item);
                }
            }

            if (!empty($data['discount_pct'])) {
                $subtotal = $subtotal * (1 - $data['discount_pct'] / 100);
            }

            // Include 12% VAT in total
            $totalWithVat = round($subtotal * 1.12, 2);

            $status = $data['payment_method'] === 'gcash' ? 'pending_payment' : 'pending';

            $sale = Sale::create([
                'customer_id' => $data['customer_id'],
                'processed_by' => $user->id,
                'discount_pct' => $data['discount_pct'] ?? null,
                'total_amount' => $totalWithVat,
                'payment_method' => $data['payment_method'],
                'payment_phone_number' => $data['payment_phone_number'] ?? null,
                'status' => $status,
                'notes' => $data['notes'] ?? null,
            ]);

            $sale->update([
                'order_number' => 'ORD-' . str_pad($sale->id, 5, '0', STR_PAD_LEFT),
            ]);

            foreach ($itemsData as $item) {
                $sale->items()->create($item);
            }

            // Auto-create delivery with tracking number
            $trackingNumber = 'TRK-' . strtoupper(substr(md5($sale->id . now()->timestamp), 0, 8));

            // Get customer coordinates for delivery destination
            $customerProfile = \App\Models\CustomerProfile::where('user_id', $data['customer_id'])->first();

            // Wave 6 — stamp rider fee + COD cash at delivery creation. Rider can never
            // edit these. delivery_fee comes from Setting, cash_collected only set on COD.
            $riderFee = (float) Setting::get('rider_default_delivery_fee', 30);
            $cashCollected = (($data['payment_method'] ?? null) === 'cod')
                ? (float) ($sale->total_amount ?? 0)
                : 0.00;

            Delivery::create([
                'sale_id' => $sale->id,
                'tracking_number' => $trackingNumber,
                'status' => 'waiting', // New status: Hidden from Riders until Admin confirms
                'address' => $data['address'] ?? 'TBD',
                'latitude' => $customerProfile->latitude ?? null,
                'longitude' => $customerProfile->longitude ?? null,
                'delivery_fee' => $riderFee,
                'cash_collected' => $cashCollected,
                'payout_status' => 'pending',
            ]);

            return $sale;
        });

        $customerId = $sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_orders', 'admin_dashboard', 'admin_deliveries'], 'sale.created'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_cart'], 'sale.created'));

        return [
            'sale' => $sale->load(['customer', 'items.product', 'delivery']),
            'gcash_payload' => Setting::get('gcash_payload', env('GCASH_BASE_PAYLOAD', '')),
        ];
    }

    /**
     * Deduct stock for variant.
     */
    private function deductVariantStock($product, $item)
    {
        $variant = \App\Models\ProductVariant::with(['sizeValue', 'colorValue', 'weightValue'])
            ->whereKey($item['product_variant_id'])
            ->lockForUpdate()
            ->first();

        if (!$variant) {
            throw ValidationException::withMessages([
                'items' => ["Insufficient stock for {$product->name}. Available: 0"],
            ]);
        }

        $available = max(0, (int) $variant->stock);
        if ($item['quantity'] > $available) {
            throw ValidationException::withMessages([
                'items' => ["Insufficient stock for {$product->name}. Available: {$available}"],
            ]);
        }

        $oldStock = $variant->stock;
        $variant->decrement('stock', $item['quantity']);

        // Also deduct from inventory current_stock for variants to maintain sync
        $variantInventory = Inventory::where('product_id', $item['product_id'])
            ->where('product_variant_id', $item['product_variant_id'])
            ->lockForUpdate()
            ->first();

        if ($variantInventory) {
            $variantInventory->decrement('current_stock', $item['quantity']);
        }

        \Log::info('Stock deducted for variant', [
            'variant_id' => $item['product_variant_id'],
            'old_stock' => $oldStock,
            'quantity' => $item['quantity'],
            'new_stock' => $oldStock - $item['quantity']
        ]);

        // Stock alert checks for variant
        $newStock = $oldStock - $item['quantity'];
        $threshold = $variantInventory ? (int) $variantInventory->reorder_threshold : 5;
        $variantParts = array_filter([
            $variant->sizeValue->label ?? null,
            $variant->colorValue->label ?? null,
            $variant->weightValue->label ?? null,
        ]);
        $variantSuffix = $variantParts ? ' (' . implode(' / ', $variantParts) . ')' : '';
        $productName = $product->name . $variantSuffix;
        $this->checkStockAlerts($productName, $newStock, $threshold);
    }

    /**
     * Deduct stock for base product.
     */
    private function deductProductStock($product, $item)
    {
        $inv = Inventory::where('product_id', $item['product_id'])
            ->whereNull('product_variant_id')
            ->lockForUpdate()
            ->first();

        if (!$inv) {
            throw ValidationException::withMessages([
                'items' => ["Insufficient stock for {$product->name}. Available: 0"],
            ]);
        }

        $available = max(0, (int) $inv->current_stock);
        if ($item['quantity'] > $available) {
            throw ValidationException::withMessages([
                'items' => ["Insufficient stock for {$product->name}. Available: {$available}"],
            ]);
        }

        $oldStock = $inv->current_stock;
        $inv->decrement('current_stock', $item['quantity']);

        \Log::info('Stock deducted for product', [
            'product_id' => $item['product_id'],
            'old_stock' => $oldStock,
            'quantity' => $item['quantity'],
            'new_stock' => $oldStock - $item['quantity']
        ]);

        // Stock alert checks for base product
        $newStock = $oldStock - $item['quantity'];
        $this->checkStockAlerts($product->name, $newStock, $inv->reorder_threshold ?? 5);
    }

    /**
     * Check stock levels after a sale and notify admins if thresholds are hit.
     */
    private function checkStockAlerts(string $productName, int $newStock, int $reorderThreshold)
    {
        try {
            if ($newStock <= 0 && Setting::get('out_of_stock_alerts', '0') === '1') {
                $admins = \App\Models\User::whereIn('id', \Illuminate\Support\Facades\Cache::remember(
                    'admin_user_ids',
                    300,
                    fn () => \App\Models\User::where('role', 'admin')->pluck('id')->all()
                ))->get();

                foreach ($admins as $admin) {
                    $admin->notify(new \App\Notifications\StockAlert('out_of_stock', $productName, max(0, $newStock), $reorderThreshold));
                }
            } elseif ($newStock > 0 && $newStock <= $reorderThreshold && Setting::get('low_stock_alerts', '0') === '1') {
                $admins = \App\Models\User::whereIn('id', \Illuminate\Support\Facades\Cache::remember(
                    'admin_user_ids',
                    300,
                    fn () => \App\Models\User::where('role', 'admin')->pluck('id')->all()
                ))->get();

                foreach ($admins as $admin) {
                    $admin->notify(new \App\Notifications\StockAlert('low_stock', $productName, $newStock, $reorderThreshold));
                }
            }
        } catch (\Exception $e) {
            \Log::warning('Stock alert notification failed: ' . $e->getMessage());
        }
    }
}
