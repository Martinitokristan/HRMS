<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Sale;
use App\Models\ReturnOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $currentMonth = now()->startOfMonth();

        $query = User::where('role', 'customer')
            ->with(['profile'])
            ->withCount(['sales as orders_count'])
            ->withSum('sales as total_spent', 'total_amount')
            ->when($request->status, function($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function($q) use ($request) {
                return $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('email', 'like', "%{$request->search}%");
            })
            ->latest();

        $customers = $query->get()->map(function ($customer) {
            $data = $customer->toArray();
            $data['photo'] = $customer->photo ? asset('storage/' . $customer->photo) : null;
            $data['profile'] = $customer->profile ? $customer->profile->toArray() : null;
            return $data;
        })->toArray();

        $activeThisMonth = User::where('role', 'customer')
            ->whereHas('sales', function($q) use ($currentMonth) {
                return $q->where('created_at', '>=', $currentMonth);
            })
            ->count();

        $suspendedCount = User::where('role', 'customer')->where('status', 'suspended')->count();

        return response()->json([
            'data'             => $customers,
            'active_this_month'=> $activeThisMonth,
            'suspended_count'  => $suspendedCount,
            'status'           => 'success',
        ]);
    }

    public function myOrders(Request $request)
    {
        $orders = Sale::with(['items.product', 'items.productVariant.sizeValue', 'items.productVariant.colorValue', 'items.productVariant.weightValue', 'delivery.rider.riderProfile'])
            ->where('customer_id', $request->user()->id)
            ->latest()
            ->get()
            ->map(function ($order) {
                $arr = $order->toArray();
                $arr['has_return'] = ReturnOrder::where('sale_id', $order->id)
                    ->whereIn('status', ['pending', 'approved', 'completed'])
                    ->exists();
                return $arr;
            })
            ->values()
            ->toArray();
        return response()->json(['data' => $orders, 'status' => 'success']);
    }

    public function myProfile(Request $request)
    {
        $user = $request->user();
        $profile = \App\Models\CustomerProfile::where('user_id', $user->id)
            ->first();
        
        if (!$profile) {
            // Return empty profile with user info
            return response()->json([
                'data' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'photo' => $user->photo ? asset('storage/' . $user->photo) : null,
                ],
                'status' => 'success'
            ]);
        }

        // Add user info to response
        $data = $profile->toArray();
        $data['phone'] = $user->phone;
        $data['photo'] = $user->photo ? asset('storage/' . $user->photo) : null;
        // Ensure name/email are present
        $data['name'] = $user->name;
        $data['email'] = $user->email;

        return response()->json([
            'data' => $data,
            'status' => 'success'
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            // User information
            'name'           => 'sometimes|nullable|string|max:255',
            'email'          => 'sometimes|nullable|string|email|max:255|unique:users,email,' . $user->id,
            'phone'          => 'sometimes|nullable|string|max:20|unique:users,phone,' . $user->id,
            // Personal information
            'age'            => 'nullable|integer|min:1|max:150',
            'sex'            => 'nullable|string|in:male,female,other',
            // Simple address fields
            'address'        => 'nullable|string|max:500',
            'landmark'       => 'nullable|string|max:255',
            'zip_code'       => 'nullable|string|max:10',
            // PSGC hierarchical fields
            'region_code'    => 'nullable|string|max:20',
            'region_name'    => 'nullable|string|max:100',
            'province_code'  => 'nullable|string|max:20',
            'province_name'  => 'nullable|string|max:100',
            'city_code'      => 'nullable|string|max:20',
            'city_name'      => 'nullable|string|max:100',
            'barangay_code'  => 'nullable|string|max:20',
            'barangay_name'  => 'nullable|string|max:100',
            'street'         => 'nullable|string|max:255',
            // Geolocation
            'latitude'       => 'nullable|numeric',
            'longitude'      => 'nullable|numeric',
        ]);

        // Update user-level fields in users table
        $userFields = array_filter($request->only(['name', 'email', 'phone']), function($v) { return $v !== null; });
        if (!empty($userFields)) {
            $user->update($userFields);
        }

        // Update profile-level fields (all fields including new name/email + PSGC)
        $profileData = $request->only([
            'name', 'email',
            'age', 'sex',
            'address', 'landmark', 'zip_code',
            'region_code', 'region_name',
            'province_code', 'province_name',
            'city_code', 'city_name',
            'barangay_code', 'barangay_name',
            'street',
            'latitude', 'longitude'
        ]);
        $profile = \App\Models\CustomerProfile::updateOrCreate(
            ['user_id' => $user->id],
            array_filter($profileData, function($v) { return $v !== null; })
        );

        return response()->json([
            'data'    => $profile->toArray(),
            'message' => 'Profile updated successfully',
            'status'  => 'success',
        ]);
    }

    public function uploadPhoto(Request $request)
    {
        $request->validate([
            'photo' => 'required|image|max:2048|dimensions:max_width=4000,max_height=4000',
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
