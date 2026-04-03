<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Supplier;

class EnsureRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string  ...$roles  One or more allowed roles (e.g. 'admin', 'customer', 'rider', 'supplier')
     * @return mixed
     */
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $authedUser = $request->user();

        if (!$authedUser) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Supplier check: if the authenticated model is a Supplier instance,
        // only allow through if 'supplier' is in the allowed roles list.
        if ($authedUser instanceof Supplier) {
            if (in_array('supplier', $roles)) {
                return $next($request);
            }

            return response()->json([
                'message' => 'Unauthorized. Insufficient role.',
                'status'  => 'error',
            ], 403);
        }

        // Regular user check (admin / customer / rider)
        if ($authedUser instanceof User) {
            if (in_array($authedUser->role, $roles)) {
                return $next($request);
            }

            return response()->json([
                'message' => 'Unauthorized. Insufficient role.',
                'status'  => 'error',
            ], 403);
        }

        // Unknown model type — deny
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }
}
