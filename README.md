# Multitune

A  web app for collecting, organizing, and playing music from multiple sources.

## Structure
- `apps/backend`: Node.js/Express backend (TypeScript, Postgres)
- `apps/frontend`: React frontend

## Database (Postgres)

This project uses a local Postgres database via Docker for development.

**Default connection settings:**

- Host: `localhost`
- Port: `5432`
- User: `multitune`
- Password: `multitune`
- Database: `multitune`


---


## Running Database Migrations (No Local psql Needed)

If you don't have `psql` installed, you can run migrations using Docker. This works even on a fresh machine:

1. Make sure your database container is running:
   docker compose -f docker-compose.yml -f docker-compose.dev.yml database up

2. Run each migration: 
   for f in ./apps/backend/migrations/*.sql; do
      docker run --rm \
    -e PGPASSWORD=multitune \
    -v "$PWD/apps/backend/migrations":/migrations \
    --network container:multitune-database-1 \
    postgres:16 \
    psql -h database -U multitune -d multitune -f "/migrations/$(basename "$f")"


3. After running all migrations, continue with the normal setup:

   ```sh
   npm install

   # for development we use the override docker-compose.dev.yml
   docker compose -f docker-compose.yml -f docker-compose.dev.yml database up

   # for production it would be just the normal docker up
   docker compose -f docker-compose.yml up

   # run dev backend and frontend servers
   npm run dev --workspace=apps/backend
   npm start --workspace=apps/frontend
   ```

## Stopping the Servers

- To stop either the backend or frontend server, press `Ctrl+C` in the terminal where it is running.

See each app's README for more details and advanced usage.
