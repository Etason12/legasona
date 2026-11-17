#!/bin/bash
set -e
cd "$(dirname "$0")"
export FLASK_APP=run.py
flask db upgrade
# Import vehicles from the Mekelle vehicle-import Excel file on every redeploy.
# Idempotent: skips VINs already in the database.
flask import-vehicles || true
# Schema bootstrap runs once above (during the app import for `flask db
# upgrade`); stop each gunicorn worker from repeating the DDL concurrently.
export LEGASONA_SKIP_BOOTSTRAP=1
exec gunicorn run:app --worker-class sync --workers 2 --timeout 120 --access-logfile - --bind 0.0.0.0:$PORT