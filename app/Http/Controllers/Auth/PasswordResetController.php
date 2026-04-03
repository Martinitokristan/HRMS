<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Supplier;
use App\Services\BrevoEmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;

class PasswordResetController extends Controller
{
    /**
     * Send a password reset link to the given email.
     * Checks users table first, then suppliers.
     * Always returns the same success message to prevent email enumeration.
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower(trim($request->email));

        // Check if a token was already sent recently (within 60 seconds) — prevent spam
        $existing = DB::table('password_resets')->where('email', $email)->first();
        if ($existing && $existing->created_at && Carbon::parse($existing->created_at)->diffInSeconds(now()) < 60) {
            return response()->json([
                'message' => 'If this email is registered, a password reset link has been sent.',
                'status' => 'success',
            ]);
        }

        // Look up the account — users first, then suppliers
        $name = null;
        $userType = null;

        $user = User::where('email', $email)->where('status', 'active')->first();
        if ($user) {
            $name = $user->name;
            $userType = 'user';
        } else {
            $supplier = Supplier::where('email', $email)->first();
            if ($supplier) {
                $name = $supplier->contact_name ?: $supplier->name;
                $userType = 'supplier';
            }
        }

        // If email not found in either table — return same generic success (no enumeration)
        if (!$userType) {
            return response()->json([
                'message' => 'If this email is registered, a password reset link has been sent.',
                'status' => 'success',
            ]);
        }

        // Generate token and store
        $token = Str::random(64);

        // Delete any existing token for this email first
        DB::table('password_resets')->where('email', $email)->delete();

        DB::table('password_resets')->insert([
            'email' => $email,
            'token' => $token,
            'created_at' => now(),
        ]);

        // Send reset email — fail silently to prevent enumeration
        try {
            BrevoEmailService::sendPasswordResetEmail($email, $name, $token, $userType);
        } catch (\Exception $e) {
            Log::error("Password reset email failed for {$email}: " . $e->getMessage());
        }

        return response()->json([
            'message' => 'If this email is registered, a password reset link has been sent.',
            'status' => 'success',
        ]);
    }

    /**
     * Reset the password using a valid token.
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/'],
        ], [
            'password.regex' => 'Password must contain at least 8 characters, one letter and one number.',
        ]);

        $email = strtolower(trim($request->email));

        // Find the token
        $record = DB::table('password_resets')
            ->where('email', $email)
            ->where('token', $request->token)
            ->first();

        if (!$record) {
            return response()->json([
                'message' => 'Invalid or expired reset link.',
                'status' => 'error',
            ], 422);
        }

        // Check token expiry — 15 minutes TTL
        if (Carbon::parse($record->created_at)->addMinutes(15)->isPast()) {
            DB::table('password_resets')->where('email', $email)->delete();
            return response()->json([
                'message' => 'This reset link has expired. Please request a new one.',
                'status' => 'error',
            ], 422);
        }

        // Find the account — users first, then suppliers
        $user = User::where('email', $email)->first();
        if ($user) {
            $user->update(['password' => Hash::make($request->password)]);
        } else {
            $supplier = Supplier::where('email', $email)->first();
            if ($supplier) {
                $supplier->update(['password' => Hash::make($request->password)]);
            } else {
                // Edge case: token exists but account was deleted
                DB::table('password_resets')->where('email', $email)->delete();
                return response()->json([
                    'message' => 'Account not found.',
                    'status' => 'error',
                ], 422);
            }
        }

        // Delete the used token
        DB::table('password_resets')->where('email', $email)->delete();

        return response()->json([
            'message' => 'Password reset successfully. You can now log in with your new password.',
            'status' => 'success',
        ]);
    }
}
