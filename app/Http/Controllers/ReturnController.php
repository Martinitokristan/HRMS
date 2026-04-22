<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Models\ReturnOrder;
use App\Models\Sale;
use App\Models\Inventory;
use App\Models\CustomerNotification;
use App\Models\Setting;
use App\Traits\RestoresStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReturnController extends Controller
{
    use RestoresStock;

    public function index(Request $request)
    {
        $query = ReturnOrder::with(['sale.customer', 'sale.items.product', 'requestedBy', 'approvedBy'])
            ->when($request->status && $request->status !== 'all', function ($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function ($q) use ($request) {
                return $q->where('return_number', 'like', "%{$request->search}%")
                    ->orWhereHas('sale', function ($sq) use ($request) {
                        $sq->where('order_number', 'like', "%{$request->search}%");
                    })
                    ->orWhereHas('requestedBy', function ($uq) use ($request) {
                        $uq->where('name', 'like', "%{$request->search}%");
                    });
            })
            ->latest();

        $returns = $query->paginate($request->get('per_page', 20));

        $stats = [
            'total'     => ReturnOrder::count(),
            'pending'   => ReturnOrder::where('status', 'pending')->count(),
            'approved'  => ReturnOrder::where('status', 'approved')->count(),
            'rejected'  => ReturnOrder::where('status', 'rejected')->count(),
            'completed' => ReturnOrder::where('status', 'completed')->count(),
        ];

        return response()->json([
            'data'   => $returns,
            'stats'  => $stats,
            'status' => 'success',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sale_id'        => 'required|exists:sales,id',
            'reason'         => 'required|in:defective,wrong_item,damaged,not_as_described,missing_parts,other',
            'reason_details' => 'nullable|string|max:1000',
            'items'          => 'required|array|min:1',
            'items.*.sale_item_id' => 'required|integer',
            'items.*.quantity'     => 'required|integer|min:1',
            'images'         => 'nullable|array|max:5',
            'images.*'       => 'image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $sale = Sale::with('items')->findOrFail($data['sale_id']);
        $user = $request->user();

        // Only the customer who owns the order can request return
        if ($sale->customer_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized', 'status' => 'error'], 403);
        }

        // Only delivered orders can be returned
        if ($sale->status !== 'delivered') {
            return response()->json([
                'message' => 'Only delivered orders can be returned.',
                'status'  => 'error',
            ], 422);
        }

        // Check if a pending return already exists for this sale
        $existingReturn = ReturnOrder::where('sale_id', $sale->id)
            ->whereIn('status', ['pending', 'approved'])
            ->first();

        if ($existingReturn) {
            return response()->json([
                'message' => 'A return request already exists for this order.',
                'status'  => 'error',
            ], 422);
        }

        // Validate return items against sale items
        $returnItems = [];
        $refundAmount = 0;

        foreach ($data['items'] as $ri) {
            $saleItem = $sale->items->find($ri['sale_item_id']);
            if (!$saleItem) {
                return response()->json([
                    'message' => "Sale item #{$ri['sale_item_id']} not found in this order.",
                    'status'  => 'error',
                ], 422);
            }
            if ($ri['quantity'] > $saleItem->quantity) {
                return response()->json([
                    'message' => "Return quantity exceeds ordered quantity for {$saleItem->product->name}.",
                    'status'  => 'error',
                ], 422);
            }

            $itemRefund = ($saleItem->unit_price * $ri['quantity']);
            $refundAmount += $itemRefund;

            $returnItems[] = [
                'sale_item_id'     => $saleItem->id,
                'product_id'       => $saleItem->product_id,
                'product_variant_id' => $saleItem->product_variant_id,
                'product_name'     => $saleItem->product->name ?? 'Unknown',
                'quantity'         => $ri['quantity'],
                'unit_price'       => $saleItem->unit_price,
                'refund_amount'    => $itemRefund,
            ];
        }

        // Apply discount if original order had one
        if ($sale->discount_pct) {
            $refundAmount = $refundAmount * (1 - $sale->discount_pct / 100);
        }

        // Include VAT in refund
        $refundAmount = round($refundAmount * 1.12, 2);

        // Handle image uploads
        $images = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                $images[] = $file->store('returns', 'public');
            }
        }

        $lastId = ReturnOrder::max('id') ?? 0;
        $returnNumber = 'RET-' . str_pad($lastId + 1, 5, '0', STR_PAD_LEFT);

        $return = ReturnOrder::create([
            'return_number'  => $returnNumber,
            'sale_id'        => $sale->id,
            'requested_by'   => $user->id,
            'reason'         => $data['reason'],
            'reason_details' => $data['reason_details'] ?? null,
            'status'         => 'pending',
            'refund_amount'  => $refundAmount,
            'items'          => $returnItems,
            'images'         => $images,
        ]);

        $customerId = $return->sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_returns', 'admin_dashboard'], 'return.created'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_returns', 'customer_orders'], 'return.created'));

        return response()->json([
            'data'    => $return->load(['sale.customer', 'requestedBy']),
            'message' => 'Return request submitted successfully. Awaiting admin approval.',
            'status'  => 'success',
        ], 201);

    }

    public function show($id)
    {
        $return = ReturnOrder::with(['sale.customer', 'sale.items.product', 'requestedBy', 'approvedBy'])
            ->findOrFail($id);

        return response()->json(['data' => $return, 'status' => 'success']);
    }

    public function approve(Request $request, $id)
    {
        $return = ReturnOrder::with(['sale.items'])->findOrFail($id);

        if ($return->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending returns can be approved.',
                'status'  => 'error',
            ], 422);
        }

        $request->validate([
            'refund_method' => 'required|in:original_payment,store_credit,cash',
            'admin_notes'   => 'nullable|string|max:1000',
        ]);

        DB::transaction(function () use ($return, $request) {
            // Restore stock for returned items (sold count intentionally unchanged)
            $this->restoreStockFromReturnItems($return->items ?? []);

            $return->update([
                'status'        => 'approved',
                'refund_method' => $request->refund_method,
                'admin_notes'   => $request->admin_notes,
                'approved_by'   => $request->user()->id,
                'approved_at'   => now(),
            ]);

            // Update sale status
            $return->sale->update(['status' => 'returned']);

            // Notify customer in-app (gated by setting)
            if (Setting::get('return_approved_notify', '0') === '1') {
                CustomerNotification::create([
                    'customer_id' => $return->sale->customer_id,
                    'type'        => 'return_approved',
                    'title'       => 'Return Approved',
                    'message'     => "Your return request #{$return->return_number} has been approved. Refund: ₱" . number_format($return->refund_amount, 2),
                    'is_read'     => false,
                ]);
            }
        });

        $customerId = $return->sale->customer_id;
        $notifyKeys = Setting::get('return_approved_notify', '0') === '1'
            ? ['customer_returns', 'customer_notifications']
            : ['customer_returns'];
        broadcast(new DataMutated('private-admin', ['admin_returns', 'admin_inventory', 'admin_dashboard'], 'return.approved'));
        broadcast(new DataMutated("private-customer.{$customerId}", $notifyKeys, 'return.approved'));

        return response()->json([
            'data'    => $return->fresh()->load(['sale.customer', 'requestedBy', 'approvedBy']),
            'message' => 'Return approved. Stock restored and customer notified.',
            'status'  => 'success',
        ]);
    }

    public function reject(Request $request, $id)
    {
        $return = ReturnOrder::findOrFail($id);

        if ($return->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending returns can be rejected.',
                'status'  => 'error',
            ], 422);
        }

        $request->validate([
            'admin_notes' => 'required|string|max:1000',
        ]);

        $return->update([
            'status'      => 'rejected',
            'admin_notes' => $request->admin_notes,
            'approved_by' => $request->user()->id,
            'rejected_at' => now(),
        ]);

        // Notify customer
        CustomerNotification::create([
            'customer_id' => $return->sale->customer_id,
            'type'        => 'return_rejected',
            'title'       => 'Return Rejected',
            'message'     => "Your return request #{$return->return_number} has been rejected. Reason: {$request->admin_notes}",
            'is_read'     => false,
        ]);

        $customerId = $return->sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_returns'], 'return.rejected'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_returns', 'customer_notifications'], 'return.rejected'));

        return response()->json([
            'data'    => $return->fresh()->load(['sale.customer', 'requestedBy', 'approvedBy']),
            'message' => 'Return rejected. Customer notified.',
            'status'  => 'success',
        ]);
    }

    public function complete(Request $request, $id)
    {
        $return = ReturnOrder::findOrFail($id);

        if ($return->status !== 'approved') {
            return response()->json([
                'message' => 'Only approved returns can be marked as completed.',
                'status'  => 'error',
            ], 422);
        }

        $return->update([
            'status'       => 'completed',
            'completed_at' => now(),
        ]);

        // Notify customer
        CustomerNotification::create([
            'customer_id' => $return->sale->customer_id,
            'type'        => 'return_completed',
            'title'       => 'Refund Processed',
            'message'     => "Your refund of ₱" . number_format($return->refund_amount, 2) . " for return #{$return->return_number} has been processed.",
            'is_read'     => false,
        ]);

        $customerId = $return->sale->customer_id;
        broadcast(new DataMutated('private-admin', ['admin_returns', 'admin_dashboard'], 'return.completed'));
        broadcast(new DataMutated("private-customer.{$customerId}", ['customer_returns', 'customer_notifications'], 'return.completed'));

        return response()->json([
            'data'    => $return->fresh()->load(['sale.customer', 'requestedBy', 'approvedBy']),
            'message' => 'Return completed. Refund processed.',
            'status'  => 'success',
        ]);
    }

    public function customerReturns(Request $request)
    {
        $returns = ReturnOrder::with(['sale.items.product'])
            ->where('requested_by', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $returns, 'status' => 'success']);
    }
}
