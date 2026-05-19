# Caching

Enable caching to speed up repeated GET requests. Caching is disabled by default. Enable via environment variables (or pass `cache` in the object to `JXP()`):

```
CACHE_ENABLED=true
CACHE_DEBUG=false
CACHE_TTL=3600
```

## How it works

JXP uses an in-process [node-cache](https://www.npmjs.com/package/node-cache) store (not Memcached or Redis). When caching is enabled:

- Successful GET responses for list and single-item routes may be stored under a key derived from the model name, item id, and query string.
- Response headers include:
  - `jxp-cache`: `hit` or `miss`
  - `jxp-cache-key`: the cache key used for that request
- POST, PUT, and DELETE operations clear cached keys for the affected model.

Set `CACHE_DEBUG=true` to log cache expiry and flush events to the console.

## Admin endpoints

Requires **admin** authentication (same as other admin-only routes):

- `GET /cache/stats` — returns node-cache statistics when caching is enabled, or `{ "cache_enabled": false }` when disabled
- `GET /cache/clear` — flushes all cached entries

See also [Configuration](configuration.md#cache).
