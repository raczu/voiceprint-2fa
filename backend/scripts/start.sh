#!/bin/bash
set -e

APP_ENV=${ENVIRONMENT:-development}

if [ "$APP_ENV" != "development" ] && [ "$APP_ENV" != "production" ]; then
  echo "Error: ENVIRONMENT must be 'development' or 'production', got $APP_ENV"
  exit 1
fi

echo "Running database migrations..."
alembic upgrade head

echo "Running database seeder..."
python -m app.database.seeder

if [ "$APP_ENV" == "production" ]; then
  exec fastapi run --host 0.0.0.0 --workers 4 app/main.py
else
  exec fastapi dev --host 0.0.0.0 app/main.py
fi