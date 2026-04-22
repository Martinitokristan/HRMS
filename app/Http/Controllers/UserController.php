<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('riderProfile')
            ->when($request->role, function($q) use ($request) {
                return $q->where('role', $request->role);
            })
            ->when($request->status, function($q) use ($request) {
                return $q->where('status', $request->status);
            })
            ->when($request->search, function($q) use ($request) {
                return $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('email', 'like', "%{$request->search}%");
            })
            ->latest();

        return response()->json([
            'data'   => $query->paginate($request->get('per_page', 20)),
            'counts' => [
                'admins'    => User::where('role', 'admin')->count(),
                'customers' => User::where('role', 'customer')->count(),
                'riders'    => User::where('role', 'rider')->count(),
                'suspended' => User::where('status', 'suspended')->count(),
            ],
            'status' => 'success',
        ]);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $request->validate([
            'name'  => 'required|string|max:100',
            'email' => "required|email|unique:users,email,{$id}",
            'phone' => 'nullable|string|max:20',
            'role'  => 'required|in:admin,customer,rider',
        ]);

        $data = $request->only(['name', 'email', 'phone', 'role']);

        if ($request->password) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        broadcast(new DataMutated('private-admin', ['admin_users', 'admin_riders'], 'user.updated'));

        return response()->json([
            'data'    => $user->fresh(),
            'message' => 'User updated',
            'status'  => 'success',
        ]);
    }

    public function suspend($id)
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'suspended']);
        
        // Revoke all API tokens
        $user->tokens()->delete();

        broadcast(new DataMutated('private-admin', ['admin_users', 'admin_riders'], 'user.suspended'));

        return response()->json(['message' => 'User suspended', 'status' => 'success']);
    }

    public function restore($id)
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'active']);

        broadcast(new DataMutated('private-admin', ['admin_users', 'admin_riders'], 'user.restored'));

        return response()->json(['message' => 'User restored', 'status' => 'success']);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $user->delete();

        broadcast(new DataMutated('private-admin', ['admin_users', 'admin_riders'], 'user.deleted'));

        return response()->json(['message' => 'User deleted', 'status' => 'success']);
    }
}
