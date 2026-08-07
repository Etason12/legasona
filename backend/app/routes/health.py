import logging
from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)
logger = logging.getLogger(__name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    from app import db
    from sqlalchemy import text, inspect as sa_inspect
    try:
        with db.engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        insp = sa_inspect(db.engine)
        tables = insp.get_table_names()
        return jsonify({'status': 'ok', 'db': 'connected', 'tables': tables}), 200
    except Exception as e:
        logger.error(f'Health check failed: {e}', exc_info=True)
        return jsonify({'status': 'error', 'db': 'unavailable'}), 500
