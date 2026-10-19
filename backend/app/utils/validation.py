def safe_int(value, default=None, min_val=None, max_val=None):
    """Safely convert a value to integer with optional bounds checking."""
    if value is None:
        return default
    try:
        result = int(value)
    except (ValueError, TypeError):
        return default
    if min_val is not None and result < min_val:
        return min_val
    if max_val is not None and result > max_val:
        return max_val
    return result

def truncate(value, max_len, default=None):
    """Coerce a value to a trimmed string that fits a VARCHAR(max_len) column.

    Returns ``default`` (None by default) for missing/blank values. Postgres
    enforces column lengths that SQLite ignores, so user-supplied strings must
    be bounded here to avoid DataError/500s.
    """
    if value is None:
        return default
    s = str(value).strip()
    if not s:
        return default
    return s[:max_len]


def safe_float(value, default=None, min_val=None, max_val=None):
    """Safely convert a value to float with optional bounds checking."""
    if value is None:
        return default
    try:
        result = float(value)
    except (ValueError, TypeError):
        return default
    if min_val is not None and result < min_val:
        return min_val
    if max_val is not None and result > max_val:
        return max_val
    return result
