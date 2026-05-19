# Caching

Enable caching to speed up your queries. Caching is disabled by default. Enable via environment variables (or pass `cache` in the object to `JXP()`):

```
CACHE_ENABLED=true
CACHE_DEBUG=false
CACHE_TTL=3600
```