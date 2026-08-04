import time
from collections import defaultdict

# Shared in-memory rate limiter with TTL expiry
# Suitable for single-worker deployments (Render free tier)

_rate_limits = defaultdict(list)

def is_rate_limited(key, max_attempts, window_seconds):
    """Check if a key has exceeded the rate limit."""
    now = time.time()
    timestamps = [t for t in _rate_limits[key] if now - t < window_seconds]
    _rate_limits[key] = timestamps
    return len(timestamps) >= max_attempts

def record_attempt(key):
    """Record a timestamped attempt for the given key."""
    _rate_limits[key].append(time.time())

def get_client_ip():
    """Extract client IP from X-Forwarded-For or remote_addr."""
    from flask import request
    return request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown').split(',')[0].strip()
