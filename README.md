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
   stuff





   # run migrations
   for f in ./apps/backend/migrations/*.sql; do
      docker run --rm \
    -e PGPASSWORD=multitune \
    -v "$PWD/apps/backend/migrations":/migrations \
    --network container:multitune-database-1 \
    postgres:16 \
    psql -h database -U multitune -d multitune -f "/migrations/$(basename "$f")"
   done



   # for production or local test of docker build run:
   docker compose -f docker-compose.yml up

   # for dev machine: backend and frontend servers
   npm run dev --workspace=apps/backend
   npm run dev --workspace=apps/frontend
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up database
