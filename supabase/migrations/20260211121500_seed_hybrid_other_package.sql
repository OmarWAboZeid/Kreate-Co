insert into campaign_packages
  (name, package_type, deal_type, influencer_video_count, ugc_video_count, description, price_amount, currency, customizable, active)
select 'Hybrid Other', 'custom', 'collab', null, null, 'Custom hybrid package', 0, 'USD', true, true
where not exists (
  select 1 from campaign_packages
  where name = 'Hybrid Other' and package_type = 'custom' and deal_type = 'collab'
);

insert into campaign_packages
  (name, package_type, deal_type, influencer_video_count, ugc_video_count, description, price_amount, currency, customizable, active)
select 'Hybrid Other', 'custom', 'paid', null, null, 'Custom hybrid package', 0, 'USD', true, true
where not exists (
  select 1 from campaign_packages
  where name = 'Hybrid Other' and package_type = 'custom' and deal_type = 'paid'
);

insert into campaign_packages
  (name, package_type, deal_type, influencer_video_count, ugc_video_count, description, price_amount, currency, customizable, active)
select 'Hybrid Other', 'custom', 'mix', null, null, 'Custom hybrid package', 0, 'USD', true, true
where not exists (
  select 1 from campaign_packages
  where name = 'Hybrid Other' and package_type = 'custom' and deal_type = 'mix'
);
