from app.models import ActivityLog, db
from flask import request

def log_activity(user_id, action, description):
    log = ActivityLog(
        user_id=user_id,
        action=action,
        description=description
    )
    db.session.add(log)
    try:
        db.session.commit()
    except:
        db.session.rollback()
