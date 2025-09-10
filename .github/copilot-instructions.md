# Copilot Instructions for Multitune

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
- Key directories: `apps/backend/src/` (7 files), `apps/frontend/src/` (3 files)
- Database migrations: 6 SQL files in `apps/backend/migrations/`

## Build and Development Instructions

### Prerequisites
- Node.js 20.x (confirmed working with v20.19.5)
- npm 10.x (confirmed working with v10.8.2)  
- Docker & Docker Compose v2+ for database
- PostgreSQL client tools (for migrations)

### Environment Setup - REQUIRED EVERY TIME

**CRITICAL**: Always set up environment files before running any servers. The backend will crash without proper OAuth credentials.

1. **Root `.env` file** (required for Docker Compose):
```bash
POSTGRES_USER=multitune
POSTGRES_PASSWORD=multitune
POSTGRES_DB=multitune
```

2. **Backend `.env` file** at `apps/backend/.env` (required for backend):
```bash
DATABASE_URL=postgres://multitune:multitune@localhost:5432/multitune
DB_USER=multitune
DB_PASSWORD=multitune
DB_HOST=localhost
DB_PORT=5432
DB_NAME=multitune
PORT=9876
FRONTEND_HOST=localhost
FRONTEND_PORT=3000
JWT_SECRET=dev_secret_key

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
VITE_BACKEND_PORT=9876
```

**Note**: Use PORT=9876 for backend as ports 4000-4001 may be occupied in development environments.

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
# Should show: "Server listening on port 9876"
```

5. **Start Frontend** (in new terminal):  
```bash
npm run dev --workspace=apps/frontend
# Should show: "VITE v7.1.5 ready in 229 ms" and "Local: http://localhost:3000/"
```

### Build Commands

**Backend Build** (~2 seconds):
```bash
npm run build --workspace=apps/backend  # Compiles TypeScript to dist/
```

**Frontend Build** (~5-10 seconds):
```bash
npm run build --workspace=apps/frontend  # Runs tsc && vite build, outputs to build/
```

**Full Build** (test both):
```bash
npm run build --workspace=apps/backend && npm run build --workspace=apps/frontend
```

### Testing and Validation

**Backend Health Check**:
```bash
curl http://localhost:9876/                    # Should return: "Multitune backend is running!"
curl http://localhost:9876/db-test            # Should return JSON with timestamp
```

**Common Build Issues**:
- **Port conflicts**: If backend fails with `EADDRINUSE`, change PORT in backend .env
- **Missing env vars**: Backend crashes immediately with OAuth errors if .env is missing
- **Database not ready**: Migrations fail if database container isn't fully started
- **Environment loading**: The backend env.ts loads both root .env and local .env files

## Project Layout and Architecture

### Directory Structure
```
/
├── .github/workflows/deploy.yml          # CI/CD: Docker build & deploy
├── .env                                  # Docker Compose environment
├── package.json                          # Root workspace config
├── docker-compose.yml                    # Production container setup
├── docker-compose.dev.yml                # Dev override (database only)
│
├── apps/backend/                         # Express API server
│   ├── .env                             # Backend environment (required!)
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
    ├── .env                             # Frontend environment (required!)
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
- Backend loads: root `.env` then `apps/backend/.env` (local overrides root)
- Frontend uses Vite env vars (must start with `VITE_`)
- Docker Compose loads root `.env` for container environment

## Trust These Instructions

These instructions have been validated by running all commands and testing the complete development workflow. Always follow the exact sequence for environment setup and starting services. The backend WILL fail without proper .env configuration. If you encounter issues not covered here, only then should you search the codebase for additional information.