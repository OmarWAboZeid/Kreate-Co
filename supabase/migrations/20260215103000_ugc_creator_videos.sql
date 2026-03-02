alter table creators
  add column if not exists ugc_video_urls text[] not null default '{}'::text[];

update creators
set ugc_video_urls = '{}'::text[]
where ugc_video_urls is null;

drop view if exists ugc_creators;

create view ugc_creators as
select
  id,
  display_name as name,
  phone,
  handle,
  primary_niche as niche,
  has_mock_video,
  portfolio_url,
  ugc_video_urls,
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
