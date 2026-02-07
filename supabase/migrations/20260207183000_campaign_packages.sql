create table if not exists campaign_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  package_type text not null check (package_type in ('influencer', 'ugc', 'bundle', 'custom')),
  deal_type text not null check (deal_type in ('collab', 'paid', 'mix')),
  influencer_video_count integer,
  ugc_video_count integer,
  description text,
  price_amount numeric(12, 2) not null,
  currency text not null default 'USD',
  customizable boolean not null default false,
  active boolean not null default true,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (package_type = 'influencer' and influencer_video_count is not null and ugc_video_count is null) or
    (package_type = 'ugc' and ugc_video_count is not null and influencer_video_count is null) or
    (package_type = 'bundle' and ugc_video_count is not null and influencer_video_count is not null) or
    (package_type = 'custom' and influencer_video_count is null and ugc_video_count is null)
  )
);

create index if not exists campaign_packages_org_id_idx on campaign_packages(organization_id);
create index if not exists campaign_packages_active_idx on campaign_packages(active);
