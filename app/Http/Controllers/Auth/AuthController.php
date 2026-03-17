<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $role = $request->get('role', 'customer');

        $rules = [
            'name'         => 'required|string|max:100',
            'email'        => 'required|email|unique:users,email',
            'phone'        => 'required|string|max:20',
            'password'     => 'required|string|min:8|confirmed',
        ];

        if ($role === 'rider') {
            $rules = array_merge($rules, [
                'vehicle_type'   => 'required|string',
                'plate_number'   => 'required|string',
                'license_number' => 'required|string',
                'address'        => 'required|string',
                'valid_id_type'  => 'required|string',
                'valid_id_file'  => 'required|file|image|max:5000',
            ]);
        } else {
            $rules = array_merge($rules, [
                'province'     => 'required|string|max:100',
                'municipality' => 'required|string|max:100',
                'zip_code'     => 'required|string|max:10',
                'address'      => 'required|string|max:255',
            ]);
        }

        $request->validate($rules);

        $user = \DB::transaction(function () use ($request, $role) {
            $user = User::create([
                'name'     => $request->name,
                'email'    => $request->email,
                'phone'    => $request->phone,
                'role'     => $role,
                'status'   => $role === 'rider' ? 'pending' : 'active',
                'password' => Hash::make($request->password),
            ]);

            if ($role === 'rider') {
                $idPath = null;
                if ($request->hasFile('valid_id_file')) {
                    $idPath = $request->file('valid_id_file')->store('rider_ids', 'public');
                }

                \App\Models\RiderProfile::create([
                    'user_id'        => $user->id,
                    'vehicle_type'   => $request->vehicle_type,
                    'plate_number'   => $request->plate_number,
                    'license_number' => $request->license_number,
                    'address'        => $request->address,
                    'valid_id_type'  => $request->valid_id_type,
                    'valid_id_path'  => $idPath,
                    'availability'   => 'off_duty',
                ]);
            } else {
                \App\Models\CustomerProfile::create([
                    'user_id'      => $user->id,
                    'age'          => $request->age,
                    'sex'          => $request->sex,
                    'province'     => $request->province,
                    'municipality' => $request->municipality,
                    'zip_code'     => $request->zip_code,
                    'address'      => $request->address,
                    'landmark'     => $request->landmark,
                    'latitude'     => $request->latitude,
                    'longitude'    => $request->longitude,
                ]);
            }

            return $user;
        });

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data'    => $user,
            'token'   => $token,
            'message' => 'Registration successful',
            'status'  => 'success',
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }


        if ($user->status === 'suspended') {
            return response()->json([
                'message' => 'Your account has been suspended.',
                'status'  => 'error',
            ], 403);
        }

        if ($user->role === 'rider') {
            \App\Models\RiderProfile::updateOrCreate(
                ['user_id' => $user->id],
                ['availability' => 'available']
            );
        }

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data'    => $user,
            'token'   => $token,
            'message' => 'Login successful',
            'status'  => 'success',
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully',
            'status'  => 'success',
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'data'   => $request->user()->load('riderProfile'),
            'status' => 'success',
        ]);
    }
}
