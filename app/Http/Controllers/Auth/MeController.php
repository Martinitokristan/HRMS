<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class MeController extends Controller
{
    /**
     * Retrieve authenticated user details.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if ($user instanceof \App\Models\Supplier) {
            return response()->json([
                'id'           => $user->id,
                'name'         => $user->name,
                'contact_name' => $user->contact_name,
                'email'        => $user->email,
                'phone'        => $user->phone,
                'city'         => $user->city,
                'role'         => 'supplier',
                'status'       => $user->status,
                'photo'        => null,
            ], 200);
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'photo' => $user->photo ? asset('storage/' . $user->photo) : null,
        ], 200);
    }
}
