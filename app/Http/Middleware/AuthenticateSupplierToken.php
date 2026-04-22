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
        $cookieToken = $request->cookie('supplier_token');

        if ($cookieToken) {
            $accessToken = PersonalAccessToken::findToken($cookieToken);

            if ($accessToken && $accessToken->tokenable instanceof Supplier) {
                $supplier = $accessToken->tokenable;

                if ($supplier->status === 'suspended') {
                    return response()->json([
                        'message' => 'Your supplier account has been suspended.',
                        'status'  => 'error',
                    ], 403);
                }

                auth()->setUser($supplier);
                $request->setUserResolver(function () use ($supplier) {
                    return $supplier;
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
