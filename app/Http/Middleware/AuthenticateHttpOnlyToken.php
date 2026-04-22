<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class AuthenticateHttpOnlyToken
{
    /**
     * Authenticate the request using the auth_token HttpOnly cookie.
     * Resolves both User and Supplier models via Sanctum's polymorphic tokenable.
     */
    public function handle(Request $request, Closure $next)
    {
        $cookieToken = $request->cookie('auth_token');

        if ($cookieToken) {
            $accessToken = PersonalAccessToken::findToken($cookieToken);

            if ($accessToken) {
                $user = $accessToken->tokenable;

                // Ensure the user/supplier is not suspended
                if (isset($user->status) && $user->status === 'suspended') {
                    return response()->json([
                        'message' => 'Your account has been suspended.',
                        'status'  => 'error',
                    ], 403);
                }

                auth()->setUser($user);
                $request->setUserResolver(function () use ($user) {
                    return $user;
                });
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'Unauthenticated.',
            'status'  => 'error',
        ], 401);
    }
}
