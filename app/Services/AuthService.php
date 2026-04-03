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

            return $user;
        }

        return null;
    }
}
