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
        $customMessages = [
            'name.regex' => 'The name must only contain letters, spaces, dots, or hyphens.',
            'contact_name.regex' => 'The contact name must only contain letters, spaces, dots, or hyphens.',
            'phone.regex' => 'Phone number must be exactly 12 digits starting with 63.',
            'password.regex' => 'Password must contain at least 8 characters, one letter and one number.',
        ];

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z\s.-]+$/'],
            'contact_name' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z\s.-]+$/'],
            'email' => 'required|email|unique:suppliers,email',
            'phone' => ['required', 'string', 'regex:/^63\d{10}$/'],
            'address' => 'nullable|string',
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/'],
        ], $customMessages);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
                'status' => 'error',
            ], 422);
        }

        $verifyToken = Str::random(64);

        $supplier = Supplier::create([
            'name' => $request->name,
            'contact_name' => $request->contact_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'address' => $request->address,
            'password' => Hash::make($request->password),
            'status' => 'pending',
            'email_verified_at' => null,
            'email_verification_token' => $verifyToken,
        ]);

        // Send Email - Wrapped in try-catch to prevent 500 error if SMTP is broken
        // Send Email via Brevo API (Bypasses Railway SMTP block)
                $sent = \App\Services\BrevoEmailService::sendVerificationEmail($supplier->email, $supplier->name, $verifyToken, 'supplier');
        if (!$sent) {
            throw new \Exception("Failed to send verification email via Brevo API.");
        }


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

        if (!$supplier->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email address before logging in.',
                'status' => 'error',
            ], 403);
        }

        if (!$supplier->isActive() && $supplier->status === 'inactive') {
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

    public function me(Request $request)
    {
        $supplier = $request->user();
        return response()->json([
            'id'     => $supplier->id,
            'name'   => $supplier->contact_name ?? $supplier->name,
            'email'  => $supplier->email,
            'role'   => 'supplier',
            'status' => $supplier->status,
            'photo'  => null,
        ]);
    }

    public function logout(Request $request)
    {
        $cookieToken = $request->cookie('auth_token');
        if ($cookieToken) {
            $accessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($cookieToken);
            if ($accessToken) {
                $accessToken->delete();
            }
        }

        $cleared = cookie()->forget('auth_token');
        return response()->json(['status' => 'success'])->withCookie($cleared);
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

    public function changePassword(Request $request)
    {
        $supplier = $request->user();

        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
                'status' => 'error',
            ], 422);
        }

        if (!Hash::check($request->current_password, $supplier->password)) {
            return response()->json([
                'message' => 'Current password is incorrect',
                'status' => 'error',
            ], 401);
        }

        $supplier->update([
            'password' => Hash::make($request->new_password),
        ]);

        return response()->json([
            'message' => 'Password changed successfully',
            'status' => 'success',
        ]);
    }

    public function verifyEmail(Request $request)
    {
        $token = $request->query('token');

        if (!$token) {
            return response()->json(['message' => 'Invalid token.', 'status' => 'error'], 400);
        }

        $supplier = Supplier::where('email_verification_token', $token)->first();

        if (!$supplier) {
            return response()->json([
                'message' => 'Token is invalid or expired.',
                'status' => 'error',
            ], 404);
        }

        $supplier->update([
            'email_verified_at' => Carbon::now(),
            'email_verification_token' => null,
            'status' => 'active',
        ]);

        $authToken = $supplier->createToken('supplier-token')->plainTextToken;

        return response()->json([
            'message' => 'Email verified successfully',
            'status' => 'success',
            'data' => $supplier,
            'token' => $authToken
        ]);
    }

    public function resendVerification(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        
        $supplier = Supplier::where('email', $request->email)->first();
        
        if (!$supplier) {
            return response()->json(['message' => 'Supplier not found.'], 404);
        }
        
        if ($supplier->email_verified_at) {
            return response()->json(['message' => 'Email is already verified.'], 400);
        }

        $verifyToken = Str::random(64);
        $supplier->update([
            'email_verification_token' => $verifyToken
        ]);

        // Send Email via Brevo API (Bypasses Railway SMTP block)
                $sent = \App\Services\BrevoEmailService::sendVerificationEmail($supplier->email, $supplier->name, $verifyToken, 'supplier');
        if (!$sent) {
            throw new \Exception("Failed to send verification email via Brevo API.");
        }


        return response()->json(['message' => 'Verification email resent successfully!']);
    }
}
