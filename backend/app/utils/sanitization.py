import re
import bleach

# Strip all HTML tags, trim whitespace, enforce max length
def sanitize_string(text, max_length=500):
    """Sanitize a user-supplied string: strip HTML, trim, enforce max length."""
    if not isinstance(text, str):
        return text
    cleaned = bleach.clean(text, tags=[], strip=True)
    cleaned = cleaned.strip()
    if max_length and len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned

def sanitize_search(query):
    """Escape LIKE wildcard characters in search queries."""
    if not isinstance(query, str):
        return query
    return query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
