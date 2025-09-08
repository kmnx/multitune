#!/bin/sh
set -e

# Wait for database to be ready
until pg_isready -h database -U "$POSTGRES_USER"; do
  echo "Waiting for database..."
  sleep 2
done

# Run all migrations
for f in /app/migrations/*.sql; do
  echo "Running migration $f"
  psql -h database -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
done

# Start backend
node dist/index.js