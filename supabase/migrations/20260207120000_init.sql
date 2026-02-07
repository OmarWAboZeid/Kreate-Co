create extension if not exists pgcrypto;

create table if not exists identities (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text,
  org_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists org_memberships (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid references identities(id),
  organization_id uuid references organizations(id),
  role text,
  created_at timestamptz not null default now()
);

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  primary_niche text,
  country text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creator_platform_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id),
  platform text,
  platform_user_id text,
  username text,
  profile_url text,
  followers_count integer,
  following_count integer,
  is_verified boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  name text,
  objective text,
  budget_range text,
  status text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  creator_id uuid references creators(id),
  state text,
  compensation_amount numeric,
  created_at timestamptz not null default now()
);

create table if not exists campaign_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  creator_id uuid references creators(id),
  channel text,
  status text,
  notes text,
  sent_at timestamptz,
  responded_at timestamptz
);

create table if not exists content_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  creator_id uuid references creators(id),
  status text,
  version_count integer,
  notes text,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_assets (
  id uuid primary key default gen_random_uuid(),
  content_submission_id uuid references content_submissions(id),
  creator_platform_account_id uuid references creator_platform_accounts(id),
  platform_content_id text,
  content_type text,
  caption text,
  published_url text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists creator_account_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  creator_platform_account_id uuid references creator_platform_accounts(id),
  captured_at timestamptz,
  followers_count integer,
  engagement_rate numeric,
  views_avg numeric,
  created_at timestamptz not null default now()
);

create table if not exists content_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  content_asset_id uuid references content_assets(id),
  captured_at timestamptz,
  views integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  reach integer,
  engagement_rate numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists financial_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type text,
  owner_id uuid,
  tigerbeetle_account_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists financial_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  creator_id uuid references creators(id),
  event_type text,
  amount numeric,
  tigerbeetle_transfer_id bigint,
  created_at timestamptz not null default now()
);
