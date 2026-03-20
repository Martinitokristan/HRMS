<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class SupplierAuth
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        
        \Log::info('SupplierAuth middleware', [
            'has_token' => !!$token,
            'token_length' => $token ? strlen($token) : 0
        ]);
        
        if (!$token) {
            return response()->json([
                'message' => 'Unauthorized. No token provided.',
                'status' => 'error'
            ], 401);
        }

        // Find token using Sanctum's method
        $accessToken = PersonalAccessToken::findToken($token);
        
        \Log::info('Token lookup result', [
            'found' => !!$accessToken
        ]);
        
        if (!$accessToken) {
            return response()->json([
                'message' => 'Unauthorized. Invalid token.',
                'status' => 'error'
            ], 401);
        }

        // Get the supplier from the token
        $supplier = $accessToken->tokenable;
        
        \Log::info('Supplier from token', [
            'has_supplier' => !!$supplier,
            'is_active' => $supplier ? $supplier->isActive() : false
        ]);
        
        if (!$supplier || !$supplier->isActive()) {
            return response()->json([
                'message' => 'Unauthorized. Invalid token or inactive account.',
                'status' => 'error'
            ], 401);
        }

        // Set the supplier as the authenticated user for this request
        $request->setUserResolver(function () use ($supplier) {
            return $supplier;
        });

        return $next($request);
    }
}
