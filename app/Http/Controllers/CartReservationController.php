<?php

namespace App\Http\Controllers;

use App\Models\CartReservation;
use App\Models\Inventory;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CartReservationController extends Controller
{
    private const RESERVATION_MINUTES = 15;

    public function reserve(Request $request)
    {
        $data = $request->validate([
            'product_id'         => 'required|exists:products,id',
            'product_variant_id' => 'nullable|exists:product_variants,id',
            'quantity'           => 'required|integer|min:1',
        ]);

        $customerId = $request->user()->id;
        $productId = $data['product_id'];
        $variantId = $data['product_variant_id'] ?? null;
        $quantity = $data['quantity'];

        // No expiration needed - reservations are only used during checkout

        // Get available stock
        $availableStock = $this->getAvailableStock($productId, $variantId, $customerId);

        if ($quantity > $availableStock) {
            return response()->json([
                'message' => "Only {$availableStock} units available (including reservations by other customers).",
                'available' => $availableStock,
                'status'  => 'error',
            ], 422);
        }

        // Check if customer already has an active reservation for this product/variant
        $existing = CartReservation::where('customer_id', $customerId)
            ->where('product_id', $productId)
            ->where(function ($q) use ($variantId) {
                if ($variantId) {
                    $q->where('product_variant_id', $variantId);
                } else {
                    $q->whereNull('product_variant_id');
                }
            })
            ->active()
            ->first();

        if ($existing) {
            // Add to existing quantity instead of replacing it
            $newQuantity = $existing->quantity + $quantity;
            $existing->update([
                'quantity'   => $newQuantity,
                'expires_at' => now()->addMinutes(self::RESERVATION_MINUTES),
            ]);
            $reservation = $existing;
        } else {
            $reservation = CartReservation::create([
                'customer_id'        => $customerId,
                'product_id'         => $productId,
                'product_variant_id' => $variantId,
                'quantity'           => $quantity,
                'status'             => 'active',
                'expires_at'         => now()->addMinutes(self::RESERVATION_MINUTES),
            ]);
        }

return response()->json([
            'data'    => $reservation,
            'message' => "Stock reserved for " . self::RESERVATION_MINUTES . " minutes.",
            'expires_at' => $reservation->expires_at->toIso8601String(),
            'status'  => 'success',
        ]);
    }

    public function release(Request $request, $id)
    {
        $reservation = CartReservation::where('id', $id)
            ->where('customer_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();

        $reservation->update(['status' => 'expired']);

        return response()->json([
            'message' => 'Reservation released.',
            'status'  => 'success',
        ]);
    }

    public function releaseAll(Request $request)
    {
        CartReservation::where('customer_id', $request->user()->id)
            ->where('status', 'active')
            ->update(['status' => 'expired']);

        return response()->json([
            'message' => 'All reservations released.',
            'status'  => 'success',
        ]);
    }

    public function checkAvailability(Request $request)
    {
        $data = $request->validate([
            'items'                    => 'required|array|min:1',
            'items.*.product_id'       => 'required|exists:products,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.quantity'         => 'required|integer|min:1',
        ]);

        // No expiration needed - reservations are only used during checkout
        $customerId = $request->user()->id;
        $results = [];
        $allAvailable = true;

        foreach ($data['items'] as $item) {
            $variantId = $item['product_variant_id'] ?? null;
            $available = $this->getAvailableStock($item['product_id'], $variantId, $customerId);
            $sufficient = $item['quantity'] <= $available;

            if (!$sufficient) $allAvailable = false;

            $results[] = [
                'product_id'         => $item['product_id'],
                'product_variant_id' => $variantId,
                'requested'          => $item['quantity'],
                'available'          => $available,
                'sufficient'         => $sufficient,
            ];
        }

        return response()->json([
            'data'          => $results,
            'all_available' => $allAvailable,
            'status'        => 'success',
        ]);
    }

    public function myReservations(Request $request)
    {
        // No expiration needed - reservations are only used during checkout

        $reservations = CartReservation::with(['product', 'productVariant'])
            ->where('customer_id', $request->user()->id)
            ->active()
            ->get();

        return response()->json([
            'data'   => $reservations,
            'status' => 'success',
        ]);
    }

    private function getAvailableStock($productId, $variantId = null, $excludeCustomerId = null)
    {
        if ($variantId) {
            $variant = ProductVariant::find($variantId);
            $totalStock = $variant ? $variant->stock : 0;
        } else {
            $inv = Inventory::where('product_id', $productId)
                ->whereNull('product_variant_id')
                ->first();
            $totalStock = $inv ? $inv->current_stock : 0;
        }

        $reserved = CartReservation::getReservedQuantity($productId, $variantId, $excludeCustomerId);

        return max(0, $totalStock - $reserved);
    }
}
