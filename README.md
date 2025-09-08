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

   Create .env in root directory with
   POSTGRES_USER=multitune
   POSTGRES_PASSWORD=multitune
   POSTGRES_DB=multitune

   Create .env in apps/backend with
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
   FRONTEND_URL=http://localhost:3000
   PORT=4000
   DATABASE_URL=postgres://multitune:multitune@localhost:5432/multitune
   SPOTIFY_CLIENT_ID=
   SPOTIFY_CLIENT_SECRET=
   SPOTIFY_CALLBACK_URL=http://127.0.0.1:4000/auth/spotify/callback



   # for development we use the override docker-compose.dev.yml to start only the database
   docker compose -f docker-compose.yml -f docker-compose.dev.yml database up

   # run migrations
   for f in ./apps/backend/migrations/*.sql; do
      docker run --rm \
    -e PGPASSWORD=multitune \
    -v "$PWD/apps/backend/migrations":/migrations \
    --network container:multitune-database-1 \
    postgres:16 \
    psql -h database -U multitune -d multitune -f "/migrations/$(basename "$f")"



   # for production or local test of docker build run:
   docker compose -f docker-compose.yml up

   # for dev machine: backend and frontend servers
   npm run dev --workspace=apps/backend
   npm run dev --workspace=apps/frontend

## Stopping the Servers

- To stop either the backend or frontend server, press `Ctrl+C` in the terminal where it is running.

See each app's README for more details and advanced usage.
