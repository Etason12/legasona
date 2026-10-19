import os
import time
import json
import threading

# File-based rate limiter — works across multiple gunicorn workers.
# Stores timestamps in /tmp/rate_limits.json (ephemeral on Railway).

_LIMITS_FILE = os.path.join('/tmp', 'rate_limits.json')

# Guard the read-modify-write cycle within a single worker so concurrent
# requests in the same process cannot lose each other's attempts.
_LOCK = threading.Lock()

def _load():
    try:
        with open(_LIMITS_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def _save(data):
    try:
        with open(_LIMITS_FILE, 'w') as f:
            json.dump(data, f)
    except OSError:
        pass

def _gc(data, window_seconds):
    now = time.time()
    return {k: [t for t in v if now - t < window_seconds] for k, v in data.items() if any(t > now - window_seconds for t in v)}

def is_rate_limited(key, max_attempts, window_seconds):
    """Check if a key has exceeded the rate limit."""
    with _LOCK:
        data = _load()
        timestamps = data.get(key, [])
        now = time.time()
        recent = [t for t in timestamps if now - t < window_seconds]
        data[key] = recent
        _save(_gc(data, window_seconds))
        return len(recent) >= max_attempts

def record_attempt(key):
    """Record a timestamped attempt for the given key."""
    with _LOCK:
        data = _load()
        if key not in data:
            data[key] = []
        data[key].append(time.time())
        _save(data)

def get_client_ip():
    """Extract the client IP from a trusted position in X-Forwarded-For.

    The app runs behind a reverse proxy (Railway/Render) which *appends* the
    real peer address to any X-Forwarded-For the client sent. So the client's
    own value is untrusted and the **last** hop is the closest we have to the
    real caller — taking the first entry would let an attacker rotate a fake
    header and bypass rate limiting entirely.
    """
    from flask import request
    forwarded = request.headers.get('X-Forwarded-For', '')
    hops = [h.strip() for h in forwarded.split(',') if h.strip()]
    if hops:
        return hops[-1]
    return request.remote_addr or 'unknown'
