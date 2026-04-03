import { useEffect, useRef } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { markStale } from '../../store/dataStore';
import { useAuth } from '../../context/AuthContext';

// All env vars are MIX_ prefixed so laravel-mix (webpack) exposes them to the
// browser bundle via process.env. Define these in .env (root):
//
// Self-hosted Soketi:
//   MIX_PUSHER_APP_KEY=hrms-key
//   MIX_PUSHER_HOST=127.0.0.1
//   MIX_PUSHER_PORT=6001
//   MIX_PUSHER_SCHEME=http
//
// Pusher cloud (leave MIX_PUSHER_HOST empty):
//   MIX_PUSHER_APP_KEY=your_pusher_key
//   MIX_PUSHER_APP_CLUSTER=ap1
//   MIX_PUSHER_HOST=
//   MIX_PUSHER_SCHEME=https
const _host    = process.env.MIX_PUSHER_HOST;
const _port    = Number(process.env.MIX_PUSHER_PORT) || 6001;
const _scheme  = process.env.MIX_PUSHER_SCHEME || 'https';
const _cluster = process.env.MIX_PUSHER_APP_CLUSTER || 'mt1';

function buildEchoConfig() {
    const supplierToken = sessionStorage.getItem('supplier_token');
    const authHeaders = {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept':           'application/json',
    };
    if (supplierToken) {
        authHeaders['Authorization'] = `Bearer ${supplierToken}`;
    }

    return Object.assign(
        {
            broadcaster:       'pusher',
            key:               process.env.MIX_PUSHER_APP_KEY,
            cluster:           _cluster,
            forceTLS:          _scheme === 'https',
            disableStats:      true,
            enabledTransports: ['ws', 'wss'],
            authEndpoint:      '/broadcasting/auth',
            auth: {
                headers:         authHeaders,
                withCredentials: true,
            },
        },
        _host ? { wsHost: _host, wsPort: _port, wssPort: _port } : {}
    );
}

// Heartbeat interval (ms) — ping the socket to detect silent drops.
const HEARTBEAT_INTERVAL_MS = 30_000;
// How long to wait before attempting a reconnect after a drop.
const RECONNECT_DELAY_MS    = 5_000;

let echoInstance = null;

function buildEcho() {
    window.Pusher = Pusher;
    echoInstance = new Echo(buildEchoConfig());
    return echoInstance;
}

function destroyEcho() {
    if (echoInstance) {
        try { echoInstance.disconnect(); } catch (_) {}
        echoInstance = null;
    }
}

export default function RealTimeSyncBridge() {
    const { user } = useAuth();
    const reconnectTimer  = useRef(null);
    const heartbeatTimer  = useRef(null);
    const isMounted       = useRef(false);

    useEffect(() => {
        if (!user) return;

        isMounted.current = true;

        function setupChannels(echo) {
            const channelsJoined = [];

            function listen(channelName, isPrivate = true) {
                const ch = isPrivate
                    ? echo.private(channelName)
                    : echo.channel(channelName);

                ch.listen('.data.mutated', (e) => {
                    if (Array.isArray(e.stale_keys) && e.stale_keys.length) {
                        markStale(...e.stale_keys);
                    }
                });

                channelsJoined.push(channelName);
            }

            if (user.role === 'admin')
                listen('admin');

            if (user.role === 'supplier' && user.id)
                listen(`supplier.${user.id}`);

            if (user.role === 'customer')
                listen(`customer.${user.id}`);

            if (user.role === 'rider')
                listen(`rider.${user.id}`);

            listen('shop', false);

            return channelsJoined;
        }

        function connect() {
            if (!isMounted.current) return;

            const echo = buildEcho();
            const channelsJoined = setupChannels(echo);

            // Heartbeat: send a no-op ping via the underlying Pusher socket.
            // If the connection is silently dead, Pusher's internal reconnect
            // will kick in; if it never recovers we force a full rebuild.
            heartbeatTimer.current = setInterval(() => {
                try {
                    const state = echo.connector?.pusher?.connection?.state;
                    if (state && state !== 'connected') {
                        scheduleReconnect();
                    }
                } catch (_) {
                    scheduleReconnect();
                }
            }, HEARTBEAT_INTERVAL_MS);

            // Pusher SDK fires these connection state events.
            try {
                echo.connector.pusher.connection.bind('disconnected', () => {
                    if (isMounted.current) scheduleReconnect();
                });
                echo.connector.pusher.connection.bind('failed', () => {
                    if (isMounted.current) scheduleReconnect();
                });
            } catch (_) {}

            return channelsJoined;
        }

        function scheduleReconnect() {
            clearInterval(heartbeatTimer.current);
            destroyEcho();

            if (!isMounted.current) return;

            reconnectTimer.current = setTimeout(() => {
                if (isMounted.current) connect();
            }, RECONNECT_DELAY_MS);
        }

        connect();

        return () => {
            isMounted.current = false;
            clearInterval(heartbeatTimer.current);
            clearTimeout(reconnectTimer.current);
            destroyEcho();
        };
    }, [user?.id, user?.role]);

    return null;
}
