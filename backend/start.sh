#!/bin/bash
set -e
cd "$(dirname "$0")"
export FLASK_APP=run.py
flask db upgrade
exec gunicorn run:app --worker-class sync --workers 2 --timeout 120 --bind 0.0.0.0:$PORT