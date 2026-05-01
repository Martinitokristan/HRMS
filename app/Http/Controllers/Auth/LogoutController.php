<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Laravel\Sanctum\PersonalAccessToken;

class LogoutController extends Controller
{
    /**
     * Handle logout for all roles.
     * Revokes the Sanctum token and clears the auth_token HttpOnly cookie.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $cookieToken = $request->cookie('auth_token');

        if ($cookieToken) {
            $accessToken = PersonalAccessToken::findToken($cookieToken);
            if ($accessToken) {
                $accessToken->delete();
            }
        }

        $cleared = cookie('auth_token', '', -1, '/', null, app()->environment('production'), true, false, 'lax');
        return response()->json(['status' => 'success'])->withCookie($cleared);
    }
}
