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

        // Set expiration time for reservation
        $expiresAt = now()->addMinutes(self::RESERVATION_MINUTES);

        // Get available stock
        $inventory = Inventory::where('product_id', $productId)
            ->where('product_variant_id', $variantId)
            ->first();

        if (!$inventory || $inventory->current_stock < $quantity) {
            return response()->json([
                'message' => 'Insufficient stock available',
                'status'  => 'error'
            ], 422);
        }

        // Create or update reservation
        $reservation = CartReservation::updateOrCreate(
            [
                'customer_id' => $customerId,
                'product_id' => $productId,
                'product_variant_id' => $variantId,
                'status' => 'active',
            ],
            [
                'quantity' => $quantity,
                'reserved_price' => $this->getProductPrice($productId, $variantId),
                'expires_at' => $expiresAt,
            ]
        );

        return response()->json([
            'data'    => [
                'reservation_id' => $reservation->id,
                'expires_at' => $reservation->expires_at,
                'minutes_remaining' => $reservation->expires_at->diffInMinutes(now()),
            ],
            'message' => 'Item reserved successfully',
            'status'  => 'success',
        ]);
    }

    private function getProductPrice($productId, $variantId)
    {
        $product = \App\Models\Product::find($productId);
        if ($variantId) {
            $variant = \App\Models\ProductVariant::find($variantId);
            return $variant->sell_price ?? $product->sell_price;
        }
        return $product->sell_price;
    }

    public function getActiveReservations(Request $request)
    {
        $customerId = $request->user()->id;
        
        $reservations = CartReservation::with(['product', 'productVariant'])
            ->where('customer_id', $customerId)
            ->where('status', 'active')
            ->where('expires_at', '>', now())
            ->get();

        return response()->json([
            'data' => $reservations,
            'status' => 'success',
        ]);
    }

    public function clearExpiredReservations()
    {
        $expired = CartReservation::where('expires_at', '<', now())
            ->where('status', 'active')
            ->update(['status' => 'expired']);

        return response()->json([
            'message' => "Cleared {$expired} expired reservations",
            'status' => 'success',
        ]);
    }

    public function release(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'product_variant_id' => 'nullable|exists:product_variants,id',
        ]);

        $customerId = $request->user()->id;
        $productId = $data['product_id'];
        $variantId = $data['product_variant_id'] ?? null;

        $released = CartReservation::where('customer_id', $customerId)
            ->where('product_id', $productId)
            ->where('product_variant_id', $variantId)
            ->where('status', 'active')
            ->update(['status' => 'expired']);

        return response()->json([
            'message' => $released ? 'Reservation released' : 'No active reservation found',
            'status' => 'success',
        ]);
    }
}
