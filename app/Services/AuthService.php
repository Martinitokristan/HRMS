<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;
use App\Models\User;

class AuthService
{
    /**
     * Attempt to authenticate a user with the given credentials.
     *
     * @param array $credentials
     * @return User|null
     */
    public function attemptLogin(array $credentials): ?User
    {
        if (Auth::attempt($credentials)) {
            $user = Auth::user();

            // Block suspended accounts
            if ($user->status === 'suspended') {
                Auth::logout();
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'email' => ['Your account has been suspended. Please contact support.'],
                ]);
            }

            // Optional: Block unverified users for specific roles
            if (in_array($user->role, ['customer', 'supplier', 'admin']) && !$user->email_verified_at) {
                // Auth::logout(); // Keep session or logout depends on UX, usually logout for SPA
                // throw \Illuminate\Validation\ValidationException::withMessages([
                //     'email' => ['Please verify your email address before logging in.'],
                // ]);
            }

            return $user;
        }

        return null;
    }
}
