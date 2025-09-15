# Basic Operation

Multitune collects playlists and the tunes they contain from multiple music services (YouTube, Spotify, Bandcamp, etc.), and stores them in its own database. Each playlist and track is associated with the relevant service, user, and all available metadata from that service.

All data displayed on the website comes from Multitune's own database, not directly from external APIs. This enables seamless management of playlists and tracks on any supported service, or even across services, including batch operations.

When implementing features, always ensure that:
- Playlists and tracks are imported and stored with full metadata
- All user interactions and displayed data are based on the database
- Playlist and track management can be performed across services

# Copilot Instructions for Multitune

REMEMBER THAT THIS IS A TYPESCRIPT PROJECT!
ALWAYS USE TYPESCRIPT SYNTAX AND TYPES!


## Repository Overview

**Multitune** is a web application for collecting, organizing, and playing music from multiple sources (YouTube, Spotify, Bandcamp, etc.). It consists of a Node.js/TypeScript backend API with PostgreSQL database and a React/TypeScript frontend built with Vite.

### Tech Stack
- **Monorepo**: npm workspaces with two main applications
- **Backend**: Node.js 20+, Express, TypeScript, PostgreSQL, Passport.js (OAuth)
- **Frontend**: React 18, TypeScript, Vite 7, React-DOM
- **Database**: PostgreSQL 16 (via Docker)
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions (Docker Hub deployment)

### Repository Size
- ~40 source files across backend and frontend
- Key directories: `apps/backend/src/`, `apps/frontend/src/`
- Database migrations: SQL files in `apps/backend/migrations/`

### Server setup:
- Everything is containerized with Docker
- Frontend is built with Vite and served via nginx in its own container
- Backend runs in a Node.js container
- PostgreSQL database runs in its own container
- Nginx is used as a reverse proxy in production, routing to backend and frontend.

## Build and Development Instructions

### Prerequisites
- Node.js 20.x (confirmed working with v20.19.5)
- npm 10.x (confirmed working with v10.8.2)  
- Docker & Docker Compose v2+ for database
- PostgreSQL client tools (for migrations)

### Environment Setup

**CRITICAL**: Always set up environment files before running any servers. The backend will crash without proper OAuth credentials.

1. **Root and Backend `.env` file** (required for Docker Compose and backend):
- DB_HOST must be `localhost` for local dev, `database` for Docker containers
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=multitune
POSTGRES_PASSWORD=multitune
POSTGRES_DB=multitune

FRONTEND_HOST=localhost
FRONTEND_PORT=3000
JWT_SECRET=dev_secret_key
````

# OAuth credentials (use fake values for basic backend functionality)
GOOGLE_CLIENT_ID=fake_google_client_id
GOOGLE_CLIENT_SECRET=fake_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:9876/auth/google/callback
YOUTUBE_CALLBACK_URL=http://localhost:9876/auth/youtube/callback
SPOTIFY_CLIENT_ID=fake_spotify_client_id
SPOTIFY_CLIENT_SECRET=fake_spotify_client_secret
SPOTIFY_CALLBACK_URL=http://localhost:9876/auth/spotify/callback
```

3. **Frontend `.env` file** at `apps/frontend/.env`:
```bash
VITE_BACKEND_HOST=localhost
VITE_BACKEND_PORT=4000
```


### Development Workflow (Step-by-Step)

**ALWAYS follow this exact sequence:**

1. **Install Dependencies** (always run first):
```bash
cd /path/to/multitune
npm install
```

2. **Start Database**:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up database
# Wait ~10-15 seconds for database to be ready (watch for "database system is ready to accept connections")
```

3. **Run Database Migrations** (required for fresh database):
```bash
for f in ./apps/backend/migrations/*.sql; do
  docker run --rm \
    -e PGPASSWORD=multitune \
    -v "$PWD/apps/backend/migrations":/migrations \
    --network container:multitune-database-1 \
    postgres:16 \
    psql -h database -U multitune -d multitune -f "/migrations/$(basename "$f")"
done
```

4. **Start Backend** (in new terminal):
```bash
npm run dev --workspace=apps/backend
# Should show: "Server listening on port 4000"
```

5. **Start Frontend** (in new terminal):  
```bash
npm run dev --workspace=apps/frontend
# Should show: "VITE v7.1.5 ready in 229 ms" and "Local: http://localhost:3000/"
```

### Testing and Validation

**Backend Health Check**:
```bash
curl http://localhost:4000/                    # Should return: "Multitune backend is running!"
curl http://localhost:4000/db-test            # Should return JSON with timestamp
```

**Common Build Issues**:
- **Missing env vars**: Backend crashes immediately with OAuth errors if .env is missing
- **Database not ready**: Migrations fail if database container isn't fully started
- **Environment loading**: The backend env.ts loads both root .env and local .env files

## Project Layout and Architecture

### Directory Structure
```
/
├── .github/workflows/deploy.yml          # CI/CD: Docker build & deploy
├── .env                                  # Unified .env for Docker and backend
├── package.json                          # Root workspace config
├── docker-compose.yml                    # Production container setup
├── docker-compose.dev.yml                # Dev override (database only)
│
├── apps/backend/                         # Express API server
│   ├── package.json                     # Backend dependencies
│   ├── tsconfig.json                    # TypeScript config
│   ├── Dockerfile                       # Backend container
│   ├── entrypoint.sh                    # Container startup script
│   ├── migrations/*.sql                 # Database schema (6 files)
│   └── src/
│       ├── index.ts                     # Express server setup, CORS config
│       ├── env.ts                       # Environment loading (loads root + local .env)
│       ├── db.ts                        # PostgreSQL connection pool
│       ├── auth.ts                      # JWT + Google OAuth + user auth
│       ├── api_youtube.ts               # YouTube integration routes  
│       ├── api_spotify.ts               # Spotify integration routes
│       └── api_db.ts                    # Database CRUD operations
│
└── apps/frontend/                        # React + Vite SPA
    ├── .env                             # Frontend env (VITE_ vars)  
    ├── package.json                     # Frontend dependencies  
    ├── tsconfig.json                    # TypeScript config
    ├── vite.config.ts                   # Vite bundler config
    ├── Dockerfile                       # Frontend container (nginx)
    └── src/
        ├── index.tsx                    # React app entry point
        ├── App.tsx                      # Main app component
        └── vite-env.d.ts                # Vite type definitions
```

### Key Configuration Files

**TypeScript Configuration**:
- Backend: `apps/backend/tsconfig.json` - CommonJS, Node.js target
- Frontend: `apps/frontend/tsconfig.json` - ESNext, React JSX, Vite types

**Build Configuration**:
- Frontend: `apps/frontend/vite.config.ts` - React SWC plugin, port 3000, build output to `build/`
- Backend: Uses tsc directly, outputs to `dist/`

**Docker Configuration**:
- `docker-compose.yml` - Production (pulls images from Docker Hub)
- `docker-compose.dev.yml` - Development override (database only, exposes port 5432)
- Backend Dockerfile: Node.js 20 Alpine, installs postgres-client, builds TypeScript
- Frontend Dockerfile: Multi-stage (Node.js build + nginx serve)

### Database Schema

**6 Migration Files** (applied in order):
1. `001_init.sql` - Core tables: users, sources, tracks, playlists, user_playlists
2. `002_user_auth.sql` - User authentication modifications  
3. `003_password_hash_nullable.sql` - Password field updates
4. `003_playlists_youtube.sql` - YouTube playlist tables
5. `004_create_user_services.sql` - User service connections
6. `005_playlists_spotify.sql` - Spotify playlist tables

**Key Tables**: users, tracks, playlists, sources, user_playlists, youtube_playlists, spotify_playlists, user_services

### CI/CD Pipeline

**GitHub Actions** (`.github/workflows/deploy.yml`):
- Triggers on push to `main` branch
- Builds and pushes Docker images to Docker Hub
- Deploys via SSH to production server
- **Environment Requirements**: Requires secrets for DOCKERHUB_USERNAME, DOCKERHUB_TOKEN, server credentials, and frontend environment variables

**Validation Steps**:
1. Build backend Docker image from `apps/backend/`  
2. Create frontend .env from GitHub secrets
3. Build frontend Docker image from `apps/frontend/`
4. Deploy via SSH: `docker-compose pull && docker-compose down && docker-compose up -d`

## Common Development Tasks

### Making Code Changes
1. **Backend changes**: Modify files in `apps/backend/src/`, server auto-reloads with nodemon
2. **Frontend changes**: Modify files in `apps/frontend/src/`, Vite provides hot-reload
3. **Database changes**: Add new .sql file to `apps/backend/migrations/`, run migration command
4. **API routes**: Add to existing routers in `auth.ts`, `api_*.ts` files

### Adding Dependencies  
```bash
npm install <package> --workspace=apps/backend    # Backend dependency
npm install <package> --workspace=apps/frontend   # Frontend dependency
```

### Debugging
- Backend logs appear in terminal running `npm run dev --workspace=apps/backend`
- Frontend errors appear in browser console at http://localhost:3000
- Database logs: `docker compose logs database`

### Environment Variables
- Backend loads root `.env`
- Frontend uses Vite env vars (must start with `VITE_`)
- Docker Compose loads root `.env` for container environment

## Trust These Instructions

These instructions have been validated by running all commands and testing the complete development workflow. Always follow the exact sequence for environment setup and starting services. The backend WILL fail without proper .env configuration. If you encounter issues not covered here, only then should you search the codebase for additional information.