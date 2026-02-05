# Kreate & Co - UGC & Influencer Marketing Platform

## Overview

A workspace application for kreate & co, a UGC and influencer marketing company. The platform allows brands and creators to log in and access workspace features.

## Project Structure

```
├── apps/
│   ├── api/          # Node.js backend API (port 4000)
│   │   └── index.js  # Main API server with health endpoints
│   └── web/          # React frontend (Vite, port 54321)
│       ├── src/      # React components and pages
│       └── vite.config.cjs
├── supabase/         # Database migrations and config
├── package.json      # Root package with dev scripts
└── .env              # Environment configuration
```

## Running the Application

- **Development**: `npm run dev` - Runs both API and web frontend concurrently
- **API only**: `npm run dev:api` - Runs backend on port 4000
- **Web only**: `npm run dev:web` - Runs frontend on port 54321

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

## UI/UX Design System

- **Brand Colors**: Crimson (#70113F), Sand (#C6D077)
- **Design Features**:
  - Glassmorphism effects with backdrop blur
  - Gradient accents on cards and buttons
  - Micro-interactions and hover animations
  - Custom scrollbars matching brand colors
  - Animated page transitions
- **Component Styles**:
  - Cards with gradient top accents
  - Status pills with color-coded states
  - Navigation with active state indicators
  - Enhanced toggle switches and form inputs
  - Modal animations with smooth scaling

## Creator Types

- **UGC Creators**: Content creators who produce user-generated content
  - Filters: Niche, Age, Gender, Languages, Experience Level
  - Fields: name, age, gender, languages, experienceLevel, niche, region, portfolio, notes
- **Influencers**: Social media personalities with established followings
  - Filters: Niche, Follower Range, Engagement Rate, Platforms, Gender
  - Fields: name, handles, followers, engagement, niche, platforms, gender, region, notes

## Database Schema

### brands table

- id, name (unique), logo_url, created_at, updated_at

### influencers table

- id, name, tiktok_url, instagram_url, followers, niche, phone, region, notes, category, created_at, updated_at

### ugc_creators table

- id, name, phone, handle, niche, has_mock_video, portfolio_url, age, gender, languages, accepts_gifted_collab, turnaround_time, has_equipment, has_editing_skills, can_voiceover, skills_rating, base_rate, region, notes, created_at, updated_at

## API Endpoints

- `GET /api/health` - Basic health check
- `GET /api/health/db` - Database connectivity check
- `GET /api/health/tigerbeetle` - TigerBeetle service check
- `GET /api/health/all` - Combined health status
- `GET /api/influencers` - Fetch all influencers from database
- `GET /api/ugc-creators` - Fetch all UGC creators from database
- `GET /api/brands` - Fetch all brands from database
- `POST /api/brands` - Create a new brand (name, logo_url)
- `DELETE /api/brands/:id` - Delete a brand by ID
- `POST /api/uploads/request-url` - Get presigned URL for file upload
- `GET /objects/*` - Serve uploaded files from object storage

## User Roles & Permissions

- **Admin**: Full access to all features (Campaigns, Creator Network, Analytics, Settings)
- **Brand**: Access to their own campaigns, creator network, analytics, and profile settings

## Campaign Wizard Features (Brand Portal)

- **Brand Selection**: New brand (with name input) or existing brand dropdown
- **Payment Type**: Collab, Paid, or Mix
- **Campaign Type**: UGC only, Influencer only, or Hybrid
- **Objectives**: Awareness, Sales, Launch, Content Bank
- **Packages**: Bundles (Buzz/Hype/Impact/Viral) or custom package counts
- **Creator Tiers**: Multi-select (Nano/Micro/Mid-tier/Macro) - hidden for UGC-only
- **Platforms**: TikTok, Instagram
- **Content Formats**: Reel, Post, Story

## Admin Campaign Form Fields

- **Campaign Name**: Required text input
- **Brand**: Dropdown from managed brands list
- **Campaign Type**: UGC, Influencer, or Hybrid (required)
- **Deal Type**: Collab, Paid, or Mix (required)
- **Campaign Package**: 
  - UGC: 4/8/12/20 videos or Other (custom text)
  - Influencer: 10/15/20/40 videos or Other (custom text)
  - Hybrid: Buzz/Hype/Impact/Viral bundles
- **Creator Tiers**: Multi-select (Nano/Micro/Mid-tier/Macro) - only for Influencer/Hybrid
- **Platforms**: TikTok, Instagram (multi-select, required)
- **Content Format**: Reel, Post, Story (multi-select)
- **Objectives**: Awareness, Sales, Launch, Content Bank (multi-select, required)
- **Removed fields**: Budget range, Creators needed, YouTube, Live format

## Creator Workflow Management (Brand View)

- **Status Dropdown**: Filming, Brief Sent, Posted, Need Alternative
- **Final Video Link**: Input for submitted content URL
- **Add Submitted Content**: Modal with content link, type, and notes

## Authentication & Access Control

- **User Registration**: New users sign up with email/password and start in "pending" status
- **Pending Review**: Unapproved users see "Account Under Review" page and cannot access platform
- **Admin Approval**: Admins can approve/reject users from the Users management page
- **Session Management**: Server-side sessions with HTTP-only cookies (7-day expiry)
- **Protected Routes**: All /app/* routes require authentication and approved status
- **Admin Credentials**: admin@kreate.co / admin123

### User Status Flow
1. **pending** - Default for new signups, cannot access platform
2. **approved** - Can access all platform features
3. **rejected** - Access denied, redirected to login

### Auth API Endpoints
- `POST /api/auth/register` - Create new user (returns pending status)
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/user` - Get current user
- `GET /api/admin/users` - List all users (admin only)
- `POST /api/admin/users/:id/approve` - Approve user (admin only)
- `POST /api/admin/users/:id/reject` - Reject user (admin only)

## Recent Changes
- **Feb 2026**: Extracted Brands to dedicated navigation section (Admin only)
- **Feb 2026**: Complete Brand Portal overhaul with revamped campaign wizard
- **Feb 2026**: Added Employee role with restricted permissions
- **Feb 2026**: Renamed "Creators" to "Creator Network" throughout app
- **Feb 2026**: Added creator workflow management (status, video link, content submission)
- **Feb 2026**: Removed Content tab from Brand/Admin navigation
- **Feb 2026**: Added Filter by Brand dropdown for admin/employee views
- **Feb 2026**: Migrated creator data from Excel to PostgreSQL database (300 influencers, 65 UGC creators)
- **Feb 2026**: Separated Creators page into UGC Creators and Influencers with distinct filter sets
- **Feb 2026**: Comprehensive UI/UX enhancement with glassmorphism, gradients, and micro-interactions

## Notes

- The frontend is configured to proxy `/api` requests to the backend
- TigerBeetle integration requires external service (not available in Replit)
