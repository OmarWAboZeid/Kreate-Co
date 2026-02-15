-- Seed analytics-friendly content for the Rabbit demo campaign.
-- Repeatable: each insert uses NOT EXISTS guards.

with
  campaign as (
    select c.id
    from campaigns c
    join organizations o on o.id = c.organization_id
    where c.name = 'Spring Social Launch'
      and o.name = 'Rabbit'
      and o.org_type = 'BRAND'
    limit 1
  ),
  salma as (
    select id from creators where display_name = 'Salma Nour' limit 1
  ),
  omar as (
    select id from creators where display_name = 'Omar Elshenawy' limit 1
  ),
  nour as (
    select id from creators where display_name = 'Nour Ali' limit 1
  )
update campaign_participants p
set workflow_status = 'Published',
    final_video_link = 'https://www.tiktok.com/@salma.nour/video/736220001'
from campaign, salma
where p.campaign_id = campaign.id
  and p.creator_id = salma.id;

with
  campaign as (
    select c.id
    from campaigns c
    join organizations o on o.id = c.organization_id
    where c.name = 'Spring Social Launch'
      and o.name = 'Rabbit'
      and o.org_type = 'BRAND'
    limit 1
  ),
  omar as (
    select id from creators where display_name = 'Omar Elshenawy' limit 1
  )
update campaign_participants p
set workflow_status = 'Submitted',
    final_video_link = 'https://www.instagram.com/reel/CRabbitOmar01/'
from campaign, omar
where p.campaign_id = campaign.id
  and p.creator_id = omar.id;

with
  campaign as (
    select c.id
    from campaigns c
    join organizations o on o.id = c.organization_id
    where c.name = 'Spring Social Launch'
      and o.name = 'Rabbit'
      and o.org_type = 'BRAND'
    limit 1
  ),
  salma as (
    select id from creators where display_name = 'Salma Nour' limit 1
  )
insert into content_submissions (
  campaign_id,
  creator_id,
  status,
  version_count,
  notes,
  created_at,
  updated_at
)
select
  campaign.id,
  salma.id,
  'Published',
  1,
  'Seed analytics - Salma TikTok Reel',
  now() - interval '6 days',
  now() - interval '5 days'
from campaign, salma
where not exists (
  select 1
  from content_submissions s
  where s.campaign_id = campaign.id
    and s.creator_id = salma.id
    and s.notes = 'Seed analytics - Salma TikTok Reel'
);

with
  campaign as (
    select c.id
    from campaigns c
    join organizations o on o.id = c.organization_id
    where c.name = 'Spring Social Launch'
      and o.name = 'Rabbit'
      and o.org_type = 'BRAND'
    limit 1
  ),
  omar as (
    select id from creators where display_name = 'Omar Elshenawy' limit 1
  )
insert into content_submissions (
  campaign_id,
  creator_id,
  status,
  version_count,
  notes,
  created_at,
  updated_at
)
select
  campaign.id,
  omar.id,
  'Approved',
  2,
  'Seed analytics - Omar Instagram Reel',
  now() - interval '4 days',
  now() - interval '3 days'
from campaign, omar
where not exists (
  select 1
  from content_submissions s
  where s.campaign_id = campaign.id
    and s.creator_id = omar.id
    and s.notes = 'Seed analytics - Omar Instagram Reel'
);

with
  campaign as (
    select c.id
    from campaigns c
    join organizations o on o.id = c.organization_id
    where c.name = 'Spring Social Launch'
      and o.name = 'Rabbit'
      and o.org_type = 'BRAND'
    limit 1
  ),
  nour as (
    select id from creators where display_name = 'Nour Ali' limit 1
  )
insert into content_submissions (
  campaign_id,
  creator_id,
  status,
  version_count,
  notes,
  created_at,
  updated_at
)
select
  campaign.id,
  nour.id,
  'Pending Review',
  1,
  'Seed analytics - Nour UGC draft',
  now() - interval '2 days',
  now() - interval '1 day'
from campaign, nour
where not exists (
  select 1
  from content_submissions s
  where s.campaign_id = campaign.id
    and s.creator_id = nour.id
    and s.notes = 'Seed analytics - Nour UGC draft'
);

with submission as (
  select id
  from content_submissions
  where notes = 'Seed analytics - Salma TikTok Reel'
  limit 1
)
insert into content_assets (
  content_submission_id,
  platform_content_id,
  content_type,
  caption,
  published_url,
  published_at,
  created_at
)
select
  submission.id,
  'seed-salma-001',
  'TikTok Reel',
  'Morning skincare routine with Rabbit products.',
  'https://www.tiktok.com/@salma.nour/video/736220001',
  now() - interval '5 days',
  now() - interval '5 days'
from submission
where not exists (
  select 1 from content_assets a
  where a.content_submission_id = submission.id
    and a.published_url = 'https://www.tiktok.com/@salma.nour/video/736220001'
);

with submission as (
  select id
  from content_submissions
  where notes = 'Seed analytics - Omar Instagram Reel'
  limit 1
)
insert into content_assets (
  content_submission_id,
  platform_content_id,
  content_type,
  caption,
  published_url,
  published_at,
  created_at
)
select
  submission.id,
  'seed-omar-001',
  'Instagram Reel',
  'Tech-focused unboxing with Rabbit delivery CTA.',
  'https://www.instagram.com/reel/CRabbitOmar01/',
  now() - interval '3 days',
  now() - interval '3 days'
from submission
where not exists (
  select 1 from content_assets a
  where a.content_submission_id = submission.id
    and a.published_url = 'https://www.instagram.com/reel/CRabbitOmar01/'
);

with submission as (
  select id
  from content_submissions
  where notes = 'Seed analytics - Nour UGC draft'
  limit 1
)
insert into content_assets (
  content_submission_id,
  platform_content_id,
  content_type,
  caption,
  published_url,
  published_at,
  created_at
)
select
  submission.id,
  'seed-nour-001',
  'UGC Video',
  'Draft concept clip for product close-ups.',
  'https://drive.google.com/file/d/seed-nour-ugc-preview/view',
  now() - interval '1 day',
  now() - interval '1 day'
from submission
where not exists (
  select 1 from content_assets a
  where a.content_submission_id = submission.id
    and a.published_url = 'https://drive.google.com/file/d/seed-nour-ugc-preview/view'
);

with asset as (
  select id
  from content_assets
  where published_url = 'https://www.tiktok.com/@salma.nour/video/736220001'
  limit 1
)
insert into content_analytics_snapshots (
  content_asset_id,
  captured_at,
  views,
  likes,
  comments,
  shares,
  saves,
  reach,
  engagement_rate,
  raw_payload
)
select
  asset.id,
  now() - interval '1 day',
  482000,
  36140,
  2860,
  2140,
  1220,
  398500,
  8.79,
  jsonb_build_object('source', 'seed', 'label', 'salma_tiktok')
from asset
where not exists (
  select 1
  from content_analytics_snapshots s
  where s.content_asset_id = asset.id
    and s.views = 482000
    and s.likes = 36140
);

with asset as (
  select id
  from content_assets
  where published_url = 'https://www.instagram.com/reel/CRabbitOmar01/'
  limit 1
)
insert into content_analytics_snapshots (
  content_asset_id,
  captured_at,
  views,
  likes,
  comments,
  shares,
  saves,
  reach,
  engagement_rate,
  raw_payload
)
select
  asset.id,
  now() - interval '1 day',
  327400,
  21450,
  1760,
  1325,
  840,
  271900,
  7.75,
  jsonb_build_object('source', 'seed', 'label', 'omar_instagram')
from asset
where not exists (
  select 1
  from content_analytics_snapshots s
  where s.content_asset_id = asset.id
    and s.views = 327400
    and s.likes = 21450
);

with asset as (
  select id
  from content_assets
  where published_url = 'https://drive.google.com/file/d/seed-nour-ugc-preview/view'
  limit 1
)
insert into content_analytics_snapshots (
  content_asset_id,
  captured_at,
  views,
  likes,
  comments,
  shares,
  saves,
  reach,
  engagement_rate,
  raw_payload
)
select
  asset.id,
  now() - interval '12 hours',
  54800,
  2860,
  210,
  142,
  95,
  43900,
  6.04,
  jsonb_build_object('source', 'seed', 'label', 'nour_draft')
from asset
where not exists (
  select 1
  from content_analytics_snapshots s
  where s.content_asset_id = asset.id
    and s.views = 54800
    and s.likes = 2860
);
