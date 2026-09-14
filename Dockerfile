# ─────────────────────────────────────────────────────────────────────────
# Legasona Importer — single-service image
#
# One container serves BOTH the Flask API (/api/*) and the pre-built React
# frontend (frontend/dist), exactly like the current Render deployment.
# Railway, Render and any Docker host can build this file as-is.
# ─────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FLASK_APP=run.py \
    PORT=8080

WORKDIR /app

# Build tooling for any dependency without a pre-built wheel (psycopg2, Pillow)
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# Install Python deps first so this layer is cached between builds
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the rest of the repo: backend/, frontend/dist/, attachment.xlsx
COPY . .

# Normalise line endings (harmless on a Windows checkout) and make it runnable
RUN sed -i 's/\r$//' backend/start.sh && chmod +x backend/start.sh

WORKDIR /app/backend

EXPOSE 8080

# start.sh runs `flask db upgrade`, then gunicorn bound to $PORT
CMD ["./start.sh"]
