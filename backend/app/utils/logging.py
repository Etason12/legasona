from app.models import ActivityLog, db


def log_activity(user_id, action, description):
    # ActivityLog.user_id is an Integer while the JWT identity is a string.
    # Postgres rejects a text value for an integer column, so coerce here to
    # keep every caller safe.
    try:
        user_id = int(user_id) if user_id is not None else None
    except (ValueError, TypeError):
        user_id = None
    log = ActivityLog(
        user_id=user_id,
        action=action,
        description=description
    )
    db.session.add(log)
