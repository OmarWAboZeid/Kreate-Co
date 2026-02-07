alter table campaign_invitations
  add column created_at timestamptz not null default now(),
  add column created_by_user_id uuid references users(id) on delete set null,
  add column brand_decision text not null default 'pending' check (brand_decision in ('pending', 'approved', 'rejected')),
  add column brand_decision_note text,
  add column brand_decided_at timestamptz,
  add column brand_decided_by_user_id uuid references users(id) on delete set null,
  add column shortlist_rank integer;

alter table campaign_participants
  add column accepted_at timestamptz,
  add column accepted_by_user_id uuid references users(id) on delete set null,
  add column workflow_status text,
  add column final_video_link text,
  add column created_by_user_id uuid references users(id) on delete set null;

create unique index if not exists campaign_invitations_unique_creator_idx
  on campaign_invitations(campaign_id, creator_id);

create unique index if not exists campaign_participants_unique_creator_idx
  on campaign_participants(campaign_id, creator_id);
