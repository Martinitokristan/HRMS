<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class BroadcastAuthController extends Controller
{
    /**
     * Authenticate a Pusher private channel request manually.
     * This avoids needing the pusher/pusher-php-server PHP SDK.
     *
     * Pusher private channel auth:
     *   string_to_sign = "{socket_id}:{channel_name}"
     *   signature      = HMAC-SHA256(app_secret, string_to_sign)
     *   response       = {"auth": "{app_key}:{signature}"}
     */
    public function authenticate(Request $request)
    {
        // Resolve user: prefer supplier guard (session-based) then fall back to web guard.
        $user = \Illuminate\Support\Facades\Auth::guard('supplier')->user()
             ?? $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 403);
        }

        $socketId    = $request->input('socket_id');
        $channelName = $request->input('channel_name');

        if (!$socketId || !$channelName) {
            return response()->json(['error' => 'Missing socket_id or channel_name'], 422);
        }

        // Authorise by channel name
        if (!$this->authorizeChannel($user, $channelName)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $appKey    = config('broadcasting.connections.pusher.key');
        $appSecret = config('broadcasting.connections.pusher.secret');

        $stringToSign = "{$socketId}:{$channelName}";
        $signature    = hash_hmac('sha256', $stringToSign, $appSecret);

        return response()->json(['auth' => "{$appKey}:{$signature}"]);
    }

    private function authorizeChannel($user, string $channelName): bool
    {
        // Public channels — always allowed
        if (strpos($channelName, 'private-') !== 0) {
            return true;
        }

        $channel = substr($channelName, strlen('private-'));

        if ($channel === 'admin') {
            return $user->role === 'admin';
        }

        if (preg_match('/^supplier\.(\d+)$/', $channel, $m)) {
            return (int) ($user->supplier_id ?? $user->id) === (int) $m[1];
        }

        if (preg_match('/^customer\.(\d+)$/', $channel, $m)) {
            return (int) $user->id === (int) $m[1];
        }

        if (preg_match('/^rider\.(\d+)$/', $channel, $m)) {
            return (int) $user->id === (int) $m[1];
        }

        return false;
    }
}
