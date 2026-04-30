<?php

namespace App\Services\Deliveries;

use App\Events\DataMutated;
use App\Models\Delivery;
use App\Models\RiderProfile;
use App\Models\CustomerNotification;
use App\Notifications\NewFeedbackReceived;
use Illuminate\Support\Facades\Storage;

class DeliveryProofService
{
    /**
     * Upload delivery proof photo.
     */
    public function uploadProof($delivery, $user, $file, $riderLat = null, $riderLng = null)
    {
        // Verify rider owns this delivery
        if ($delivery->rider_id !== $user->id) {
            return [
                'error' => 'Unauthorized',
                'status_code' => 403,
            ];
        }

        $path = $this->processAndStoreImage($delivery->id, $file);
        $photoUrl = asset('storage/' . $path);

        $delivery->update([
            'proof_photo' => $path,
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);

        if ($delivery->sale) {
            $delivery->sale->update(['status' => 'delivered']);
        }

        if ($delivery->rider_id) {
            RiderProfile::where('user_id', $delivery->rider_id)
                ->update(['availability' => 'available']);
        }

        // Notify customer that proof photo has been uploaded
        if ($delivery->sale && $delivery->sale->customer_id) {
            $productNames = $delivery->sale->items->map(function ($item) {
                $name = $item->product ? $item->product->name : 'Product';
                $variant = collect([
                    optional(optional($item->productVariant)->sizeValue)->label,
                    optional(optional($item->productVariant)->colorValue)->label,
                    optional(optional($item->productVariant)->weightValue)->label,
                ])->filter()->implode(' / ');
                $variantSuffix = $variant ? ' (' . $variant . ')' : '';
                return $item->quantity . 'x ' . $name . $variantSuffix;
            })->implode(', ');

            CustomerNotification::create([
                'customer_id' => $delivery->sale->customer_id,
                'delivery_id' => $delivery->id,
                'type' => 'delivered',
                'title' => 'Order Delivered successfully!',
                'message' => "Your order containing {$productNames} has arrived. Please tap View Proof.",
                'meta' => [
                    'proof_url' => $photoUrl,
                    'order_number' => $delivery->sale->order_number ?? null,
                ],
                'is_read' => false,
            ]);
        }

        // Wave 6 — geofence stamp + customer-confirm notification + payout-eligibility check.
        app(GeofenceService::class)->stamp($delivery->fresh(), $riderLat, $riderLng);
        app(DeliveryReceiptService::class)->postConfirmationNotification($delivery->fresh());
        app(DeliveryPayoutEligibilityService::class)->maybePromoteToEligible($delivery->fresh());

        // Broadcasts
        $riderId = $user->id;
        $customerId = $delivery->sale ? $delivery->sale->customer_id : null;
        broadcast(new DataMutated('private-admin', ['admin_deliveries', 'admin_dashboard', 'admin_orders'], 'delivery.proof_uploaded'));
        broadcast(new DataMutated("private-rider.{$riderId}", ['rider_dashboard'], 'delivery.proof_uploaded'));
        if ($customerId) {
            broadcast(new DataMutated("private-customer.{$customerId}", ['customer_orders', 'customer_notifications'], 'delivery.proof_uploaded'));
        }

        return [
            'data' => [
                'photo_url' => $photoUrl,
                'status' => 'delivered'
            ],
            'status_code' => 200,
        ];
    }

    /**
     * Process and store image, handling HEIC/HEIF conversion if needed.
     */
    private function processAndStoreImage($deliveryId, $file)
    {
        $extension = strtolower($file->getClientOriginalExtension());

        if (in_array($extension, ['heic', 'heif'])) {
            // Convert HEIC to JPEG using ImageMagick if available
            try {
                $imageData = file_get_contents($file->getRealPath());
                $imagick = new \Imagick();
                $imagick->readImageBlob($imageData);
                $imagick->setImageFormat('jpeg');
                $imagick->setImageCompressionQuality(85);
                $jpegData = $imagick->getImageBlob();
                $imagick->destroy();

                // Store as JPEG
                $fileName = 'delivery-' . $deliveryId . '-' . time() . '.jpg';
                $path = 'delivery-proofs/' . $fileName;
                Storage::disk('public')->put($path, $jpegData);
                return $path;
            } catch (\Exception $e) {
                // Fallback: store original HEIC if conversion fails
                $path = $file->store('delivery-proofs', 'public');
                \Log::warning('HEIC conversion failed, storing original: ' . $e->getMessage());
                return $path;
            }
        }

        // Store other formats directly
        return $file->store('delivery-proofs', 'public');
    }
}
