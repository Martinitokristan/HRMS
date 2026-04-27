<?php

namespace App\Support;

use Illuminate\Cache\TaggableStore;
use Illuminate\Support\Facades\Cache;

/**
 * Centralised invalidation for the customer shop product grid cache.
 *
 * The grid key is versioned ("products:v{N}:{hash}"). Bumping the version
 * atomically invalidates every cached grid page at once — no need to
 * enumerate keys, and works on file/database drivers that don't support tags.
 *
 * When a taggable store is available (redis/memcached), we also flush the
 * ['products'] tag for defense in depth.
 */
class ProductCache
{
    public const VERSION_KEY = 'products:version';

    public static function version(): int
    {
        $v = Cache::get(self::VERSION_KEY);
        if ($v === null) {
            Cache::forever(self::VERSION_KEY, 1);
            return 1;
        }
        return (int) $v;
    }

    public static function bust(): void
    {
        // 1) Bump version — invalidates every "products:v{N}:*" key at once.
        try {
            Cache::increment(self::VERSION_KEY);
        } catch (\Throwable $e) {
            $current = (int) (Cache::get(self::VERSION_KEY, 1));
            Cache::forever(self::VERSION_KEY, $current + 1);
        }

        // 2) If the driver supports tags, flush the 'products' tag as a belt-and-braces.
        if (Cache::getStore() instanceof TaggableStore) {
            try {
                Cache::tags(['products'])->flush();
            } catch (\Throwable $e) {
                // tag flush best-effort; the version bump above is authoritative
            }
        }
    }
}
