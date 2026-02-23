create table if not exists campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'milestone',
  event_date date not null,
  created_by_user_id uuid references users(id) on delete set null,
  updated_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_events_campaign_id_idx
  on campaign_events(campaign_id, event_date, created_at);

create index if not exists campaign_events_organization_id_idx
  on campaign_events(organization_id, event_date);
