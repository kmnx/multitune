# Multitune

A modern web app for collecting, organizing, and playing music from multiple sources.

## Structure
- `apps/backend`: Node.js/Express backend (TypeScript, Postgres)
- `apps/frontend`: React frontend

## Getting Started

1. Install dependencies:
   ```sh
   yarn install
   # or
   npm install
   ```
2. Start the backend server:
   ```sh
   npm run dev --workspace=apps/backend
   ```
3. Start the frontend server:
   ```sh
   npm start --workspace=apps/frontend
   ```

## Stopping the Servers

- To stop either the backend or frontend server, press `Ctrl+C` in the terminal where it is running.

See each app's README for more details and advanced usage.
