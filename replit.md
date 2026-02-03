# Kreate & Co - UGC & Influencer Marketing Platform

## Overview
A workspace application for kreate & co, a UGC and influencer marketing company. The platform allows brands and creators to log in and access workspace features.

## Project Structure
```
├── apps/
│   ├── api/          # Node.js backend API (port 4000)
│   │   └── index.js  # Main API server with health endpoints
│   └── web/          # React frontend (Vite, port 5000)
│       ├── src/      # React components and pages
│       └── vite.config.cjs
├── supabase/         # Database migrations and config
├── package.json      # Root package with dev scripts
└── .env              # Environment configuration
```

## Running the Application
- **Development**: `npm run dev` - Runs both API and web frontend concurrently
- **API only**: `npm run dev:api` - Runs backend on port 4000
- **Web only**: `npm run dev:web` - Runs frontend on port 5000

## API Endpoints
- `GET /api/health` - Basic health check
- `GET /api/health/db` - Database connectivity check
- `GET /api/health/tigerbeetle` - TigerBeetle service check
- `GET /api/health/all` - Combined health status

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `API_PORT` - API server port (default: 4000)
- `TIGERBEETLE_ADDRESS` - TigerBeetle service address (optional)

## Tech Stack
- **Frontend**: React 18, Vite, React Router, TanStack Query
- **Backend**: Node.js, Express-like HTTP server
- **Database**: PostgreSQL (Replit managed)
- **Styling**: Custom CSS

## Notes
- The frontend is configured to proxy `/api` requests to the backend
- TigerBeetle integration requires external service (not available in Replit)
