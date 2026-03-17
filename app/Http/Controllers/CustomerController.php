<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $currentMonth = now()->startOfMonth();

        $query = User::where('role', 'customer')
            ->withCount(['sales'])
            ->withSum('sales', 'total_amount')
            ->when($request->status, function($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function($q) use ($request) {
                return $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('email', 'like', "%{$request->search}%");
            })
            ->latest();

        return response()->json([
            'data'   => $query->paginate($request->get('per_page', 15)),
            'counts' => [
                'total'         => User::where('role', 'customer')->count(),
                'active_month'  => User::where('role', 'customer')
                    ->whereHas('sales', function($q) use ($currentMonth) {
                        return $q->where('created_at', '>=', $currentMonth);
                    })
                    ->count(),
                'suspended'     => User::where('role', 'customer')->where('status', 'suspended')->count(),
            ],
            'status' => 'success',
        ]);
    }

    public function myOrders(Request $request)
    {
        $orders = \App\Models\Sale::with(['items.product', 'delivery.rider.riderProfile'])
            ->where('customer_id', $request->user()->id)
            ->latest()
            ->get();
        return response()->json(['data' => $orders, 'status' => 'success']);
    }

    public function myProfile(Request $request)
    {
        $profile = \App\Models\CustomerProfile::where('user_id', $request->user()->id)
            ->first();
        
        if (!$profile) {
            // Return empty profile instead of 404 so checkout can still proceed
            return response()->json([
                'data' => null,
                'status' => 'success'
            ]);
        }

        return response()->json([
            'data' => $profile,
            'status' => 'success'
        ]);
    }

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'address'      => 'nullable|string|max:500',
            'landmark'     => 'nullable|string|max:255',
            'province'     => 'nullable|string|max:100',
            'municipality' => 'nullable|string|max:100',
            'zip_code'     => 'nullable|string|max:10',
            'latitude'     => 'nullable|numeric',
            'longitude'    => 'nullable|numeric',
            'age'          => 'nullable|integer|min:1|max:150',
            'sex'          => 'nullable|string|in:male,female,other',
        ]);

        $profile = \App\Models\CustomerProfile::updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        return response()->json([
            'data' => $profile,
            'message' => 'Profile updated successfully',
            'status' => 'success',
        ]);
    }
}
