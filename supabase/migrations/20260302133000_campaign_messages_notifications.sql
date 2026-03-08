alter table organization_notifications
  add column if not exists campaign_id uuid references campaigns(id) on delete cascade;

create index if not exists organization_notifications_campaign_id_idx
  on organization_notifications(campaign_id);

create table if not exists campaign_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_messages_campaign_id_idx
  on campaign_messages(campaign_id, created_at);

create index if not exists campaign_messages_organization_id_idx
  on campaign_messages(organization_id, created_at);
