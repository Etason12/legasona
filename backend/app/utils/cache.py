import time
from functools import wraps

# Simple in-memory TTL cache for API responses
# Suitable for single-worker deployments

_cache = {}

def cached(ttl_seconds=60):
    """Decorator that caches function results for a given TTL.
    
    Usage:
        @cached(ttl_seconds=300)
        def get_branches():
            return Branch.query.all()
    
    Cache is invalidated when the function is called with different args,
    or when the TTL expires. To force-invalidate, call invalidate_cache().
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Build cache key from function name + args
            key = f.__qualname__ + str(args) + str(sorted(kwargs.items()))
            now = time.time()
            
            if key in _cache:
                result, expiry = _cache[key]
                if now < expiry:
                    return result
            
            result = f(*args, **kwargs)
            _cache[key] = (result, now + ttl_seconds)
            return result
        return wrapper
    return decorator

def invalidate_cache(pattern=None):
    """Invalidate cached entries. If pattern is provided, only invalidate
    entries whose key contains the pattern."""
    if pattern is None:
        _cache.clear()
    else:
        keys_to_remove = [k for k in _cache if pattern in k]
        for k in keys_to_remove:
            del _cache[k]
