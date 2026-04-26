<?php

namespace App\Services;

use Illuminate\Support\Facades\Hash;
use App\Models\User;

class AuthService
{
    /**
     * Validate user credentials without creating a session.
     * Auth is handled via Sanctum token in HttpOnly cookie.
     *
     * @param array $credentials
     * @return User|null
     */
    public function attemptLogin(array $credentials, bool $remember = false): ?User
    {
        $user = User::where('email', $credentials['email'])->first();

        if ($user && Hash::check($credentials['password'], $user->password)) {
            // Block suspended accounts
            if ($user->status === 'suspended') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'email' => ['Your account has been suspended. Please contact support.'],
                ]);
            }

            // Defense in depth: pending non-customer accounts must not be able to log in.
            // Customers auto-activate via email verification. Riders require admin approval.
            // Admin/manager should NEVER be in `pending` (created internally, already active).
            if ($user->status === 'pending' && $user->role !== 'customer') {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'email' => ['Your account is pending approval. Please wait for an administrator to activate it.'],
                ]);
            }

            return $user;
        }

        return null;
    }
}
