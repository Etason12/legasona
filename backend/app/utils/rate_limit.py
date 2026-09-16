import os
import time
import json

# File-based rate limiter — works across multiple gunicorn workers.
# Stores timestamps in /tmp/rate_limits.json (ephemeral on Railway).

_LIMITS_FILE = os.path.join('/tmp', 'rate_limits.json')

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
    data = _load()
    timestamps = data.get(key, [])
    now = time.time()
    recent = [t for t in timestamps if now - t < window_seconds]
    data[key] = recent
    _save(_gc(data, window_seconds))
    return len(recent) >= max_attempts

def record_attempt(key):
    """Record a timestamped attempt for the given key."""
    data = _load()
    if key not in data:
        data[key] = []
    data[key].append(time.time())
    _save(data)

def get_client_ip():
    """Extract client IP from X-Forwarded-For or remote_addr."""
    from flask import request
    ip = request.headers.get('X-Forwarded-For') or request.remote_addr or 'unknown'
    return ip.split(',')[0].strip()
