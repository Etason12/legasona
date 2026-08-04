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
