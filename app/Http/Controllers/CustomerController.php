<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
            ->get()
            ->map(function ($order) {
                $order->has_return = \App\Models\ReturnOrder::where('sale_id', $order->id)
                    ->whereIn('status', ['pending', 'approved', 'completed'])
                    ->exists();
                return $order;
            });
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
        $user = $request->user();

        $request->validate([
            'name'         => 'sometimes|string|max:255',
            'phone'        => 'sometimes|nullable|string|max:20',
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

        // Update user-level fields
        $userFields = array_filter($request->only(['name', 'phone']), function($v) { return $v !== null; });
        if (!empty($userFields)) {
            $user->update($userFields);
        }

        // Update profile-level fields
        $profileData = $request->only(['address', 'landmark', 'province', 'municipality', 'zip_code', 'latitude', 'longitude', 'age', 'sex']);
        $profile = \App\Models\CustomerProfile::updateOrCreate(
            ['user_id' => $user->id],
            array_filter($profileData, function($v) { return $v !== null; })
        );

        return response()->json([
            'data'    => array_merge($profile->toArray(), ['name' => $user->fresh()->name, 'phone' => $user->fresh()->phone, 'email' => $user->email]),
            'message' => 'Profile updated successfully',
            'status'  => 'success',
        ]);
    }

    public function uploadPhoto(Request $request)
    {
        $request->validate([
            'photo' => 'required|image|max:2048',
        ]);

        $user = $request->user();
        $path = $request->file('photo')->store('profile-photos', 'public');
        $user->update(['photo' => $path]);

        return response()->json([
            'status'    => 'success',
            'message'   => 'Photo updated successfully',
            'photo_url' => asset('storage/' . $path),
        ]);
    }

    public function changePassword(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'password'         => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'Current password is incorrect.',
                'errors'  => ['current_password' => ['Current password is incorrect.']],
                'status'  => 'error',
            ], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        return response()->json([
            'message' => 'Password changed successfully.',
            'status'  => 'success',
        ]);
    }
}
