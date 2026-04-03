<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use App\Models\Supplier;

class AuthenticateSupplierToken
{
    public function handle(Request $request, Closure $next)
    {
        $bearerToken = $request->bearerToken();

        if ($bearerToken) {
            $accessToken = PersonalAccessToken::findToken($bearerToken);

            if ($accessToken && $accessToken->tokenable instanceof Supplier) {
                $supplier = $accessToken->tokenable;
                auth()->setUser($supplier);
                $request->setUserResolver(fn () => $supplier);
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'Unauthenticated.',
            'status'  => 'error',
        ], 401);
    }
}
