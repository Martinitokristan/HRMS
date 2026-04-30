<?php

namespace App\Services\Deliveries;

use App\Models\Delivery;

class DeliveryQueryService
{
    /**
     * Get paginated list of deliveries with filtering and search.
     */
    public function getList($request)
    {
        $query = Delivery::with(['sale.customer', 'sale.items.product', 'rider'])
            ->when($request->status && $request->status !== 'all', function ($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->rider_id === 'me' && $request->user(), function ($q) use ($request) {
                return $q->where('rider_id', $request->user()->id);
            })
            ->when($request->rider_id && $request->rider_id !== 'me', function ($q) use ($request) {
                return $q->where('rider_id', $request->rider_id);
            });

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('tracking_number', 'like', "%{$request->search}%")
                    ->orWhere('address', 'like', "%{$request->search}%")
                    ->orWhereHas('sale', function ($sq) use ($request) {
                        $sq->where('order_number', 'like', "%{$request->search}%")
                            ->orWhereHas('customer', function ($cq) use ($request) {
                                $cq->where('name', 'like', "%{$request->search}%");
                            });
                    })
                    ->orWhereHas('rider', function ($rq) use ($request) {
                        $rq->where('name', 'like', "%{$request->search}%");
                    });
            });
        }

        $deliveries = $query->latest()->paginate($request->get('per_page', 20));

        $stats = $this->getStats();

        return [
            'deliveries' => $deliveries,
            'stats' => $stats,
        ];
    }

    /**
     * Get a single delivery with authorization check.
     */
    public function getDetail($id, $user)
    {
        $delivery = Delivery::with(['sale.customer', 'sale.items.product', 'rider'])->findOrFail($id);

        // Riders can only view deliveries assigned to them. Admins can view any.
        if ($user && $user->role === 'rider' && (int) $delivery->rider_id !== (int) $user->id) {
            return [
                'error' => 'Unauthorized. You can only view your own deliveries.',
                'status_code' => 403,
            ];
        }

        return [
            'delivery' => $delivery,
            'status_code' => 200,
        ];
    }

    /**
     * Get active delivery for a rider.
     */
    public function getActiveDelivery($riderId)
    {
        return Delivery::with(['sale.customer', 'sale.items.product'])
            ->where('rider_id', $riderId)
            ->whereIn('status', ['assigned', 'in_progress'])
            ->first();
    }

    /**
     * Get delivery stats.
     */
    private function getStats()
    {
        $today = now()->toDateString();

        return [
            'total' => Delivery::count(),
            'pending' => Delivery::where('status', 'pending')->count(),
            'in_progress' => Delivery::where('status', 'in_progress')->count(),
            'delivered' => Delivery::where('status', 'delivered')->count(),
            'failed' => Delivery::where('status', 'failed')->count(),
            'today_delivered' => Delivery::where('status', 'delivered')->whereDate('updated_at', $today)->count(),
        ];
    }
}
