-- Organizations
insert into organizations (name, org_type, logo_url)
select 'Rabbit', 'BRAND', null
where not exists (
  select 1 from organizations where name = 'Rabbit' and org_type = 'BRAND'
);

insert into organizations (name, org_type, logo_url)
select 'Chez Koukou', 'BRAND', null
where not exists (
  select 1 from organizations where name = 'Chez Koukou' and org_type = 'BRAND'
);

insert into organizations (name, org_type, logo_url)
select 'Kreate&Co Platform', 'PLATFORM', null
where not exists (
  select 1 from organizations where name = 'Kreate&Co Platform' and org_type = 'PLATFORM'
);

insert into organizations (name, org_type, logo_url)
select 'Kreate&Co Agency', 'AGENCY', null
where not exists (
  select 1 from organizations where name = 'Kreate&Co Agency' and org_type = 'AGENCY'
);

-- Campaigns
insert into campaigns (
  organization_id,
  name,
  objective,
  budget_range,
  status,
  start_date,
  end_date,
  campaign_type,
  deal_type,
  target_audience,
  deliverables,
  notes,
  platforms,
  objectives,
  content_formats,
  creator_tiers,
  package_id,
  package_price_snapshot,
  ugc_video_count,
  influencer_video_count
)
select
  o.id,
  'Spring Social Launch',
  'Drive awareness for new colorways and collect paid usage rights.',
  '$15k-$25k',
  'In Review',
  '2026-02-10'::date,
  '2026-03-05'::date,
  'Hybrid',
  'paid',
  'Women 18-35, beauty + lifestyle',
  '3 Reels, 5 Stories, 1 static post',
  'Prioritize lifestyle + beauty crossover creators with strong retention.',
  array['Instagram','TikTok']::text[],
  array['awareness','content bank']::text[],
  array['Reel','Story']::text[],
  array['micro','mid-tier']::text[],
  p.id,
  p.price_amount,
  p.ugc_video_count,
  p.influencer_video_count
from organizations o
left join campaign_packages p
  on p.name = 'Hype Bundle' and p.package_type = 'bundle' and p.deal_type = 'paid'
where o.name = 'Rabbit'
  and o.org_type = 'BRAND'
  and not exists (
    select 1 from campaigns c
    where c.name = 'Spring Social Launch' and c.organization_id = o.id
  );

insert into campaigns (
  organization_id,
  name,
  objective,
  budget_range,
  status,
  start_date,
  end_date,
  campaign_type,
  deal_type,
  target_audience,
  deliverables,
  notes,
  platforms,
  objectives,
  content_formats,
  creator_tiers,
  package_id,
  package_price_snapshot,
  ugc_video_count,
  influencer_video_count
)
select
  o.id,
  'Boutique Pop-Up',
  'Drive RSVPs and foot traffic for the Cairo event.',
  '$6k-$10k',
  'Draft',
  '2026-02-20'::date,
  '2026-02-27'::date,
  'UGC',
  'collab',
  'Local fashion + lifestyle audiences',
  '2 Reels + 3 Stories',
  'Local fashion + lifestyle creators preferred.',
  array['Instagram']::text[],
  array['awareness']::text[],
  array['Reel','Story']::text[],
  array['micro']::text[],
  p.id,
  p.price_amount,
  p.ugc_video_count,
  p.influencer_video_count
from organizations o
left join campaign_packages p
  on p.name = 'UGC 8 Videos' and p.package_type = 'ugc' and p.deal_type = 'collab'
where o.name = 'Chez Koukou'
  and o.org_type = 'BRAND'
  and not exists (
    select 1 from campaigns c
    where c.name = 'Boutique Pop-Up' and c.organization_id = o.id
  );

-- Org-wide notifications (brand orgs)
insert into organization_notifications (organization_id, message, channel, created_by_user_id)
select
  o.id,
  'Creators ready to review for Spring Social Launch.',
  'Email',
  u.id
from organizations o
join users u on u.email = 'admin@kreate.co'
where o.name = 'Rabbit' and o.org_type = 'BRAND'
  and not exists (
    select 1 from organization_notifications n
    where n.organization_id = o.id and n.message = 'Creators ready to review for Spring Social Launch.'
  );

insert into organization_notifications (organization_id, message, channel, created_by_user_id)
select
  o.id,
  'New content pending review for Spring Social Launch.',
  'WhatsApp',
  u.id
from organizations o
join users u on u.email = 'admin@kreate.co'
where o.name = 'Rabbit' and o.org_type = 'BRAND'
  and not exists (
    select 1 from organization_notifications n
    where n.organization_id = o.id and n.message = 'New content pending review for Spring Social Launch.'
  );
