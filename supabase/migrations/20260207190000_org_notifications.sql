create table if not exists organization_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  message text not null,
  channel text not null,
  read boolean not null default false,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists organization_notifications_org_id_idx
  on organization_notifications(organization_id);
create index if not exists organization_notifications_read_idx
  on organization_notifications(read);
