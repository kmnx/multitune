# Multitune - Copilot Agent Instructions

## Repository Overview

Multitune is a web application for collecting, organizing, and playing music from multiple sources (YouTube, Spotify, Bandcamp, Discogs, etc.). This is a TypeScript-based monorepo using npm workspaces with a Node.js/Express backend and React frontend, backed by PostgreSQL.

**Project Type**: Full-stack web application  
**Languages**: TypeScript (primary), SQL  
**Frameworks**: Express.js (backend), React with Vite (frontend)  
**Database**: PostgreSQL 16  
**Repository Size**: ~50 files, medium complexity  
**Target Runtime**: Node.js 20+, modern browsers  

## Build and Development Setup

### Essential Prerequisites
1. Node.js 20+ and npm
2. Docker and Docker Compose (for database)
3. PostgreSQL client tools (for migrations)

### Environment Configuration (CRITICAL)
The project requires specific environment variables to run. **Always set up environment files before attempting to build or run.**

#### Root `.env` file (REQUIRED for backend):
```bash
# Database connection
POSTGRES_USER=multitune
POSTGRES_PASSWORD=multitune
POSTGRES_DB=multitune
DATABASE_URL=postgresql://multitune:multitune@localhost:5432/multitune

# Backend server
PORT=4000
FRONTEND_HOST=localhost
FRONTEND_PORT=3000

# OAuth configuration (use dummy values for development)
JWT_SECRET=test-jwt-secret-for-dev
GOOGLE_CLIENT_ID=dummy-client-id
GOOGLE_CLIENT_SECRET=dummy-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
SPOTIFY_CLIENT_ID=dummy-spotify-id
SPOTIFY_CLIENT_SECRET=dummy-spotify-secret
SPOTIFY_CALLBACK_URL=http://localhost:4000/auth/spotify/callback

# Docker configuration
DOCKER_USERNAME=your-dockerhub-username
DB_HOST=database
DB_USER=multitune
DB_PASSWORD=multitune
DB_PORT=5432
DB_NAME=multitune
```

#### Frontend `.env` file (`apps/frontend/.env`):
```bash
VITE_BACKEND_HOST=localhost
VITE_BACKEND_PORT=4000
```

### Complete Development Setup Sequence

#### 1. Initial Setup (run once):
```bash
# Install dependencies (always run first)
npm install

# Start database (required for backend)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up database -d

# Wait for database to be ready (15-30 seconds), then run migrations
# IMPORTANT: Run migrations in this exact order
for f in ./apps/backend/migrations/*.sql; do
  echo "Running migration: $f"
  docker run --rm \
    -e PGPASSWORD=multitune \
    -v "$PWD/apps/backend/migrations":/migrations \
    --network container:multitune-database-1 \
    postgres:16 \
    psql -h database -U multitune -d multitune -f "/migrations/$(basename "$f")"
done
```

#### 2. Build Commands:
```bash
# Build backend (TypeScript compilation)
npm run build --workspace=apps/backend

# Build frontend (TypeScript + Vite)
npm run build --workspace=apps/frontend
```

#### 3. Development Servers:
```bash
# Backend development (with hot reload) - Terminal 1
npm run dev --workspace=apps/backend

# Frontend development (with hot reload) - Terminal 2  
npm run dev --workspace=apps/frontend
```

### Common Issues and Solutions

**Backend fails with "OAuth2Strategy requires a clientID"**: Missing environment variables in root `.env`. Ensure all OAuth variables are set (use dummy values for development).

**Database connection errors**: Ensure database container is running and healthy: `docker ps` should show `multitune-database-1` as running.

**Frontend can't find .env**: Vite requires `.env` file in `apps/frontend/` directory, not just the root.

**Migration failures**: Ensure database is fully ready (wait 15+ seconds after starting) and container name matches `multitune-database-1`.

## Project Architecture and Layout

### Directory Structure:
```
/
├── .github/
│   ├── workflows/deploy.yml          # CI/CD pipeline
│   └── ISSUE_TEMPLATE/              # Issue templates
├── apps/
│   ├── backend/                     # Node.js/Express API
│   │   ├── src/
│   │   │   ├── index.ts            # Main server entry point
│   │   │   ├── auth.ts             # OAuth & JWT authentication
│   │   │   ├── db.ts               # PostgreSQL connection
│   │   │   ├── env.ts              # Environment loading (from ../../.env)
│   │   │   ├── api_*.ts            # API route modules
│   │   │   └── ...
│   │   ├── migrations/             # SQL migration files (run manually)
│   │   ├── Dockerfile             # Production backend image
│   │   ├── entrypoint.sh          # Docker startup script
│   │   ├── package.json           # Backend dependencies
│   │   └── tsconfig.json          # TypeScript config
│   └── frontend/                   # React/Vite app
│       ├── src/
│       │   ├── App.tsx            # Main React component  
│       │   ├── index.tsx          # React entry point
│       │   └── vite-env.d.ts      # Vite type definitions
│       ├── vite.config.ts         # Vite configuration
│       ├── Dockerfile             # Production frontend image  
│       └── package.json           # Frontend dependencies
├── docker-compose.yml             # Production services
├── docker-compose.dev.yml         # Development database override
├── package.json                   # Root workspace configuration
└── README.md                      # Basic setup instructions
```

### Key Configuration Files:
- **Root `package.json`**: Defines npm workspaces for both apps
- **`docker-compose.yml`**: Production services (database, backend, frontend)
- **`docker-compose.dev.yml`**: Development override (exposes database port)
- **`apps/backend/tsconfig.json`**: TypeScript compilation settings
- **`apps/frontend/vite.config.ts`**: Frontend build configuration and dev server

### Database Schema:
Located in `apps/backend/migrations/*.sql` - tables for users, tracks, playlists, user authentication, and service integrations (YouTube, Spotify).

## Validation and CI/CD

### GitHub Actions Workflow (`.github/workflows/deploy.yml`):
1. **Build Stage**: 
   - Builds Docker images for backend and frontend
   - Pushes to Docker Hub (requires secrets: DOCKERHUB_USERNAME, DOCKERHUB_TOKEN)
   - Creates frontend `.env` with backend host/port from secrets

2. **Deploy Stage**:
   - SSH deployment to production server
   - Pulls latest images and restarts services
   - Requires secrets: SERVER_HOST, SERVER_USER, SERVER_SSH_KEY

### Manual Validation Steps:
```bash
# Test database connection (after migrations)
curl http://localhost:4000/db-test

# Test backend API
curl http://localhost:4000/

# Test frontend build
npm run build --workspace=apps/frontend && ls apps/frontend/build/
```

### No Automated Testing
**Important**: This repository has no linting, testing, or pre-commit hooks configured. Changes should be manually tested by running development servers and exercising the UI/API.

## Dependencies and Integration Points

### External Services Required:
- **Google OAuth**: For user authentication (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET required)
- **Spotify API**: For music integration (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET required)  
- **YouTube**: Integration via react-youtube library
- **Docker Hub**: For image storage (production deployment)

### Database Dependencies:
- **PostgreSQL 16**: Used via Docker for both development and production
- **Manual migrations**: No automated migration system - must run SQL files manually

### Notable Library Dependencies:
- **Backend**: express, passport (Google/Spotify OAuth), pg, jsonwebtoken, cors
- **Frontend**: react, vite, react-youtube, axios

## Working Efficiently with This Codebase

### Before Making Changes:
1. **Always** run `npm install` at root level first
2. **Always** ensure database is running: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up database -d`
3. **Always** verify environment files are properly configured before building
4. **Always** run migrations if database is fresh or after pulling schema changes

### Development Workflow:
1. Start database container
2. Run migrations (if needed)  
3. Start backend dev server in one terminal
4. Start frontend dev server in another terminal
5. Test changes via browser (http://localhost:3000) and API (http://localhost:4000)

### Making Database Changes:
1. Create new `.sql` file in `apps/backend/migrations/`
2. Use sequential numbering (001_, 002_, etc.)
3. Test migration manually before committing
4. **Never modify existing migration files**

### Deployment Considerations:
- Production build requires all environment secrets configured in GitHub
- Backend and frontend are deployed as separate Docker containers
- Database runs as persistent service with volume mounting

---

**Trust these instructions**: They are comprehensive and tested. Only search for additional information if these instructions are incomplete or contain errors.