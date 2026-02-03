# kreate & co

UGC & Influencer Marketing platform with a React frontend and Node.js API backend.

## Overview
- **Frontend**: React app with Vite (apps/web/) running on port 5000
- **Backend**: Node.js API (apps/api/) running on port 4000
- **Database**: PostgreSQL (via DATABASE_URL environment variable)

## Project Structure
```
apps/
  api/         - Node.js API server (port 4000)
  web/         - React frontend (Vite, port 5000)
supabase/      - Database migrations
```

## Development
Run `npm run dev` to start both the API and frontend concurrently.

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `API_PORT` - API server port (default: 4000)
- `TIGERBEETLE_ADDRESS` - TigerBeetle address (optional)

## Recent Changes
- 2026-02-03: Configured for Replit environment
  - Vite configured to use port 5000 with host 0.0.0.0 and allowedHosts: 'all'
  - Created PostgreSQL database
  - Set up build and start scripts for deployment
