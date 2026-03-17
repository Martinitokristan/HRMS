<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Carbon\Carbon;

class SupplierAuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'contact_name' => 'required|string|max:100',
            'email' => 'required|email|unique:suppliers,email',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
                'status' => 'error',
            ], 422);
        }

        $supplier = Supplier::create([
            'name' => $request->name,
            'contact_name' => $request->contact_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'address' => $request->address,
            'password' => Hash::make($request->password),
            'status' => 'pending',
            'email_verified_at' => null,
        ]);

        // Generate email verification token
        $verificationToken = Str::random(64);
        // TODO: Send verification email

        return response()->json([
            'message' => 'Supplier account created successfully. Please check your email for verification.',
            'data' => [
                'supplier' => $supplier,
                'requires_verification' => true,
            ],
            'status' => 'success',
        ], 201);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
                'status' => 'error',
            ], 422);
        }

        $supplier = Supplier::where('email', $request->email)->first();

        if (!$supplier || !Hash::check($request->password, $supplier->password)) {
            return response()->json([
                'message' => 'Invalid credentials',
                'status' => 'error',
            ], 401);
        }

        if (!$supplier->isActive()) {
            return response()->json([
                'message' => 'Account is not active. Please contact administrator.',
                'status' => 'error',
            ], 403);
        }

        // Create token for supplier
        $token = $supplier->createToken('supplier-token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'data' => [
                'supplier' => $supplier,
                'token' => $token,
            ],
            'status' => 'success',
        ]);
    }

    public function logout(Request $request)
    {
        // Revoke the token that made this request
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully',
            'status' => 'success',
        ]);
    }

    public function profile(Request $request)
    {
        return response()->json([
            'data' => $request->user(),
            'status' => 'success',
        ]);
    }

    public function updateProfile(Request $request)
    {
        $supplier = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'contact_name' => 'sometimes|string|max:100',
            'phone' => 'sometimes|string|max:20',
            'address' => 'sometimes|string',
            'password' => 'sometimes|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
                'status' => 'error',
            ], 422);
        }

        $updateData = $request->only(['name', 'contact_name', 'phone', 'address']);

        if ($request->has('password')) {
            $updateData['password'] = Hash::make($request->password);
        }

        $supplier->update($updateData);

        return response()->json([
            'message' => 'Profile updated successfully',
            'data' => $supplier->fresh(),
            'status' => 'success',
        ]);
    }

    public function verifyEmail(Request $request)
    {
        $supplier = Supplier::where('email', $request->email)->first();

        if (!$supplier) {
            return response()->json([
                'message' => 'Supplier not found',
                'status' => 'error',
            ], 404);
        }

        if ($supplier->email_verified_at) {
            return response()->json([
                'message' => 'Email already verified',
                'status' => 'success',
            ]);
        }

        $supplier->update([
            'email_verified_at' => Carbon::now(),
            'status' => 'active',
        ]);

        return response()->json([
            'message' => 'Email verified successfully',
            'status' => 'success',
        ]);
    }
}
