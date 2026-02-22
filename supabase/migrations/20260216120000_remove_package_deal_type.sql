-- Packages are no longer split by deal type.
-- 1) Merge duplicate package rows that only differ by deal_type
-- 2) Re-point campaigns.package_id to the kept package row
-- 3) Drop deal_type from campaign_packages

with ranked as (
  select
    id,
    first_value(id) over (
      partition by
        lower(trim(coalesce(name, ''))),
        package_type,
        coalesce(influencer_video_count, -1),
        coalesce(ugc_video_count, -1),
        coalesce(description, ''),
        coalesce(price_amount, 0),
        coalesce(currency, 'USD'),
        coalesce(customizable, false),
        coalesce(active, true)
      order by created_at asc, id asc
    ) as keep_id,
    row_number() over (
      partition by
        lower(trim(coalesce(name, ''))),
        package_type,
        coalesce(influencer_video_count, -1),
        coalesce(ugc_video_count, -1),
        coalesce(description, ''),
        coalesce(price_amount, 0),
        coalesce(currency, 'USD'),
        coalesce(customizable, false),
        coalesce(active, true)
      order by created_at asc, id asc
    ) as rn
  from campaign_packages
),
dupes as (
  select id, keep_id
  from ranked
  where rn > 1
)
update campaigns c
set package_id = d.keep_id
from dupes d
where c.package_id = d.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by
        lower(trim(coalesce(name, ''))),
        package_type,
        coalesce(influencer_video_count, -1),
        coalesce(ugc_video_count, -1),
        coalesce(description, ''),
        coalesce(price_amount, 0),
        coalesce(currency, 'USD'),
        coalesce(customizable, false),
        coalesce(active, true)
      order by created_at asc, id asc
    ) as rn
  from campaign_packages
)
delete from campaign_packages p
using ranked r
where p.id = r.id
  and r.rn > 1;

alter table campaign_packages
  drop column if exists deal_type;
