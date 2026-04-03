<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use App\Models\Supplier;

class LoginController extends Controller
{
    protected $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    /**
     * Handle generic login via SPA cookies.
     * Falls back to supplier table for unified portal access.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
            'remember' => ['boolean'],
        ]);

        $remember = (bool) ($credentials['remember'] ?? false);
        unset($credentials['remember']);

        // 1. Try regular user login (session-based)
        $user = $this->authService->attemptLogin($credentials, $remember);

        if ($user) {
            $request->session()->regenerate();
            return response()->json([
                'id'     => $user->id,
                'name'   => $user->name,
                'email'  => $user->email,
                'role'   => $user->role,
                'status' => $user->status,
            ], 200);
        }

        // 2. Fallback: check suppliers table (session-based via supplier guard)
        $supplier = Supplier::where('email', $credentials['email'])->first();

        if ($supplier && Hash::check($credentials['password'], $supplier->password)) {
            if (!$supplier->email_verified_at) {
                return response()->json([
                    'message' => 'Please verify your email address before logging in.',
                ], 403);
            }

            if ($supplier->status === 'inactive') {
                return response()->json([
                    'message' => 'Supplier account is inactive. Please contact administrator.',
                ], 403);
            }

            \Illuminate\Support\Facades\Auth::guard('supplier')->login($supplier, $remember);
            $request->session()->regenerate();

            return response()->json([
                'id'     => $supplier->id,
                'name'   => $supplier->contact_name ?? $supplier->name,
                'email'  => $supplier->email,
                'role'   => 'supplier',
                'status' => $supplier->status,
            ], 200);
        }

        return response()->json([
            'message' => 'The provided credentials do not match our records.'
        ], 422);
    }
}
