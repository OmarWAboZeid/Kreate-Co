alter table creators
  drop constraint if exists creators_creator_type_check;

alter table creators
  add constraint creators_creator_type_check
  check (creator_type in ('UGC', 'Influencer'));

create or replace view ugc_creators as
select
  id,
  display_name as name,
  phone,
  handle,
  primary_niche as niche,
  has_mock_video,
  portfolio_url,
  age,
  gender,
  languages,
  accepts_gifted_collab,
  turnaround_time,
  has_equipment,
  has_editing_skills,
  can_voiceover,
  skills_rating,
  base_rate,
  coalesce(country, '') as region,
  notes,
  profile_image,
  created_at
from creators
where creator_type = 'UGC';

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
  created_at
from creators
where creator_type = 'Influencer';
