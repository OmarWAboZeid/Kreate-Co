alter table creators
  add column if not exists engagement_rate numeric(6, 2),
  add column if not exists avg_views integer;

create or replace view influencers as
select
  id,
  display_name as name,
  tiktok_url,
  instagram_url,
  instagram_handle,
  tiktok_handle,
  followers,
  primary_niche as niche,
  phone,
  coalesce(country, '') as region,
  notes,
  category,
  profile_image,
  created_at,
  engagement_rate,
  avg_views,
  gender
from creators
where creator_type = 'Influencer';
