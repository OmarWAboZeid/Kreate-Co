-- Users (repeatable)
insert into users (email, password_hash, name, role, status)
values (
  'admin@kreate.co',
  '07ce20879a9fb0b71a0b8a7ac79f3b4debb39e9f3b5f2abab1ddb9237747589f7c136fc5ef4f9f5caa03741fcf0d8117f5fef7deeefb09660d9cbfcd3913984f.e6bc0fb21cd399c41da4306a7af92410',
  'Admin',
  'admin',
  'approved'
)
on conflict (email) do update
set password_hash = excluded.password_hash,
    name = excluded.name,
    role = excluded.role,
    status = excluded.status;

insert into users (email, password_hash, name, role, status)
values (
  'brand@kreate.co',
  'fbe7379e36bdbebf263f085441623fe387fa13cd57878a6200ea937c695a0f9fb98f3116ac6a52f745d42d520e2fd7ffcfe31893ae903036a5391ef4d32897ab.259def373f8cc653a41427ba26cda892',
  'Brand Manager',
  'brand',
  'approved'
)
on conflict (email) do update
set password_hash = excluded.password_hash,
    name = excluded.name,
    role = excluded.role,
    status = excluded.status;

-- Memberships (repeatable)
insert into org_memberships (identity_id, organization_id, role)
select u.id, o.id, 'brand_admin'
from users u
join organizations o on o.name = 'Rabbit' and o.org_type = 'BRAND'
where u.email = 'brand@kreate.co'
  and not exists (
    select 1 from org_memberships m
    where m.identity_id = u.id and m.organization_id = o.id
  );

insert into org_memberships (identity_id, organization_id, role)
select u.id, o.id, 'platform_admin'
from users u
join organizations o on o.name = 'Kreate&Co Platform' and o.org_type = 'PLATFORM'
where u.email = 'admin@kreate.co'
  and not exists (
    select 1 from org_memberships m
    where m.identity_id = u.id and m.organization_id = o.id
  );

-- Invitations (admin suggests, brand reviews)
with
  admin_user as (
    select id from users where email = 'admin@kreate.co'
  ),
  brand_user as (
    select id from users where email = 'brand@kreate.co'
  ),
  campaign as (
    select c.id
    from campaigns c
    join organizations o on o.id = c.organization_id
    where c.name = 'Spring Social Launch'
      and o.name = 'Rabbit'
    limit 1
  ),
  salma as (
    select id from creators where display_name = 'Salma Nour'
  ),
  omar as (
    select id from creators where display_name = 'Omar Elshenawy'
  ),
  lena as (
    select id from creators where display_name = 'Lena Mansour'
  ),
  nour as (
    select id from creators where display_name = 'Nour Ali'
  )
insert into campaign_invitations (
  campaign_id,
  creator_id,
  channel,
  status,
  notes,
  sent_at,
  responded_at,
  created_by_user_id,
  brand_decision,
  brand_decision_note,
  brand_decided_at,
  brand_decided_by_user_id,
  shortlist_rank
)
select
  campaign.id,
  salma.id,
  'Email',
  'invited',
  'Suggested by admin',
  now(),
  null::timestamptz,
  admin_user.id,
  'approved',
  'Strong UGC fit.',
  now(),
  brand_user.id,
  1
from campaign, salma, admin_user, brand_user
where not exists (
  select 1 from campaign_invitations i
  where i.campaign_id = campaign.id and i.creator_id = salma.id
)
union all
select
  campaign.id,
  omar.id,
  'Email',
  'invited',
  'Suggested by admin',
  now(),
  null::timestamptz,
  admin_user.id,
  'approved',
  'Great tech audience.',
  now(),
  brand_user.id,
  2
from campaign, omar, admin_user, brand_user
where not exists (
  select 1 from campaign_invitations i
  where i.campaign_id = campaign.id and i.creator_id = omar.id
)
union all
select
  campaign.id,
  lena.id,
  null,
  'shortlisted',
  'Suggested by admin',
  null::timestamptz,
  null::timestamptz,
  admin_user.id,
  'rejected',
  'Not aligned to campaign brief.',
  now(),
  brand_user.id,
  3
from campaign, lena, admin_user, brand_user
where not exists (
  select 1 from campaign_invitations i
  where i.campaign_id = campaign.id and i.creator_id = lena.id
)
union all
select
  campaign.id,
  nour.id,
  null,
  'shortlisted',
  'Suggested by admin',
  null::timestamptz,
  null::timestamptz,
  admin_user.id,
  'pending',
  null,
  null,
  null,
  4
from campaign, nour, admin_user, brand_user
where not exists (
  select 1 from campaign_invitations i
  where i.campaign_id = campaign.id and i.creator_id = nour.id
);

-- Participants (only after approval)
with
  admin_user as (
    select id from users where email = 'admin@kreate.co'
  ),
  campaign as (
    select c.id
    from campaigns c
    join organizations o on o.id = c.organization_id
    where c.name = 'Spring Social Launch'
      and o.name = 'Rabbit'
    limit 1
  ),
  salma as (
    select id from creators where display_name = 'Salma Nour'
  ),
  omar as (
    select id from creators where display_name = 'Omar Elshenawy'
  )
insert into campaign_participants (
  campaign_id,
  creator_id,
  state,
  created_at,
  accepted_at,
  workflow_status,
  final_video_link,
  created_by_user_id
)
select
  campaign.id,
  salma.id,
  'active',
  now(),
  now(),
  'Brief Sent',
  null,
  admin_user.id
from campaign, salma, admin_user
where not exists (
  select 1 from campaign_participants p
  where p.campaign_id = campaign.id and p.creator_id = salma.id
)
union all
select
  campaign.id,
  omar.id,
  'active',
  now(),
  now(),
  'Filming',
  null,
  admin_user.id
from campaign, omar, admin_user
where not exists (
  select 1 from campaign_participants p
  where p.campaign_id = campaign.id and p.creator_id = omar.id
);
