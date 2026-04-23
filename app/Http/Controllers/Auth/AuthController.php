<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $role = $request->get('role', 'customer');

        $rules = [
            'name' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z\s.-]+$/'],
            'email' => 'required|email|unique:users,email',
            'phone' => ['required', 'string', 'regex:/^63\d{10}$/'],
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/'],
        ];

        $customMessages = [
            'name.regex' => 'The name must only contain letters, spaces, dots, or hyphens.',
            'phone.regex' => 'Phone number must be exactly 12 digits starting with 63.',
            'password.regex' => 'Password must contain at least 8 characters, one letter and one number.',
        ];

        if ($role === 'rider') {
            $rules = array_merge($rules, [
                'vehicle_type' => 'required|string',
                'vehicle_model' => 'required|string',
                'plate_number' => 'required|string',
                'license_number' => 'required|string',
                'address' => 'required|string',
                'valid_id_type' => 'required|string',
                'valid_id_file' => 'required|file|image|mimes:jpeg,png,jpg|max:5000',
                'id_number' => 'required|string',
                'emergency_contact' => 'required|string',
            ]);
            $customMessages['valid_id_file.image'] = 'The valid ID must be an image file (jpeg, png, jpg).';
            $customMessages['valid_id_file.mimes'] = 'The valid ID must be an image file (jpeg, png, jpg).';
        } else {
            $rules = array_merge($rules, [
                'province' => 'required|string|max:100',
                'municipality' => 'required|string|max:100',
                'zip_code' => 'nullable|string|max:10',
                'address' => 'required|string|max:255',
                // Optional PSGC codes for consistency with settings dropdowns
                'region_code' => 'nullable|string|max:20',
                'region_name' => 'nullable|string|max:100',
                'province_code' => 'nullable|string|max:20',
                'city_code' => 'nullable|string|max:20',
                'barangay_code' => 'nullable|string|max:20',
                'barangay_name' => 'nullable|string|max:100',
                'street' => 'nullable|string|max:255',
                'landmark' => 'nullable|string|max:255',
            ]);
        }

        $request->validate($rules, $customMessages);

        $verifyToken = Str::random(64);

        $user = \DB::transaction(function () use ($request, $role, $verifyToken) {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'phone' => $request->phone,
                'role' => $role,
                'status' => 'pending',
                'password' => Hash::make($request->password),
                'email_verification_token' => $verifyToken,
            ]);

            if ($role === 'rider') {
                $idPath = null;
                if ($request->hasFile('valid_id_file')) {
                    $idPath = $request->file('valid_id_file')->store('rider_ids', 'public');
                }

                \App\Models\RiderProfile::create([
                    'user_id' => $user->id,
                    'vehicle_type' => $request->vehicle_type,
                    'vehicle_model' => $request->vehicle_model,
                    'plate_number' => $request->plate_number,
                    'license_number' => $request->license_number,
                    'address' => $request->address,
                    'valid_id_type' => $request->valid_id_type,
                    'valid_id_path' => $idPath,
                    'id_number' => $request->id_number,
                    'id_file_path' => $idPath,
                    'emergency_contact' => $request->emergency_contact,
                    'availability' => 'off_duty',
                ]);
            } else {
                    \App\Models\CustomerProfile::create([
                        'user_id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'age' => $request->age,
                        'sex' => $request->sex,
                        // PSGC structured data
                        'region_code' => $request->region_code,
                        'region_name' => $request->region_name,
                        'province_code' => $request->province_code,
                        'province_name' => $request->province_code ? $request->province : $request->province,
                        'city_code' => $request->city_code,
                        'city_name' => $request->city_code ? $request->municipality : $request->municipality,
                        'barangay_code' => $request->barangay_code,
                        'barangay_name' => $request->barangay_name,
                        // Address details
                        'zip_code' => $request->zip_code,
                        'address' => $request->address,
                        'street' => $request->street ?? $request->address, // Fallover for consistency
                        'landmark' => $request->landmark,
                        'latitude' => $request->latitude,
                        'longitude' => $request->longitude,
                    ]);
            }

            return $user;
        });

        // Send Email - Wrapped in try-catch to prevent 500 error if SMTP is broken
        // Send Email via Brevo API (Bypasses Railway SMTP block)
        $sent = \App\Services\BrevoEmailService::sendVerificationEmail($user->email, $user->name, $verifyToken, $role);
        if (!$sent) {
            throw new \Exception("Failed to send verification email. Please check server logs.");
        }

        return response()->json([
            'message' => 'Registration successful! Please check your email to verify your account.',
            'status' => 'success',
        ], 201);
    }

    public function verifyEmail(Request $request)
    {
        $token = $request->query('token');

        if (!$token) {
            return response()->json(['message' => 'Invalid token.', 'status' => 'error'], 400);
        }

        $user = User::where('email_verification_token', $token)->first();

        if (!$user) {
            return response()->json(['message' => 'Token is invalid or expired.', 'status' => 'error'], 404);
        }

        // Activate customer immediately, leave rider as pending for admin approval
        $status = $user->role === 'customer' ? 'active' : 'pending';

        $user->update([
            'email_verified_at' => Carbon::now(),
            'email_verification_token' => null,
            'status' => $status
        ]);

        $response = [
            'message' => $user->role === 'customer' 
                ? 'Email verified successfully! Logging you in...' 
                : 'Email verified successfully! Please log in.',
            'status' => 'success',
            'data' => $user
        ];

        // Auto-login for customers
        if ($user->role === 'customer') {
            $token = $user->createToken('auth_token')->plainTextToken;
            $response['token'] = $token;
            $cookie = $this->buildAuthCookie($token);
            return response()->json($response)->withCookie($cookie);
        }

        return response()->json($response);
    }

    private function buildAuthCookie(string $token)
    {
        return cookie(
            'auth_token',
            $token,
            60 * 24 * 365,
            '/',
            null,
            app()->environment('production'),
            true, // httpOnly
            false,
            'lax'
        );
    }

    public function resendVerification(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Email is already verified.'], 400);
        }

        $verifyToken = Str::random(64);
        $user->update([
            'email_verification_token' => $verifyToken
        ]);

        // Send Email via Brevo API (Bypasses Railway SMTP block)
        $sent = \App\Services\BrevoEmailService::sendVerificationEmail($user->email, $user->name, $verifyToken, $user->role);
        if (!$sent) {
            throw new \Exception("Failed to resend verification email. Please check server logs.");
        }

        return response()->json(['message' => 'Verification email resent successfully!']);
    }
}
