insert into campaign_packages
  (name, package_type, deal_type, influencer_video_count, ugc_video_count, description, price_amount, currency, customizable, active)
values
  -- Collab: Influencer packages
  ('Influencer 10 Videos', 'influencer', 'collab', 10, null, null, 0, 'USD', false, true),
  ('Influencer 15 Videos', 'influencer', 'collab', 15, null, null, 0, 'USD', false, true),
  ('Influencer 20 Videos', 'influencer', 'collab', 20, null, null, 0, 'USD', false, true),
  ('Influencer 40 Videos', 'influencer', 'collab', 40, null, null, 0, 'USD', false, true),
  ('Influencer Other', 'custom', 'collab', null, null, 'Custom influencer package', 0, 'USD', true, true),
  -- Collab: UGC packages
  ('UGC 4 Videos', 'ugc', 'collab', null, 4, null, 0, 'USD', false, true),
  ('UGC 8 Videos', 'ugc', 'collab', null, 8, null, 0, 'USD', false, true),
  ('UGC 12 Videos', 'ugc', 'collab', null, 12, null, 0, 'USD', false, true),
  ('UGC 20 Videos', 'ugc', 'collab', null, 20, null, 0, 'USD', false, true),
  ('UGC Other', 'custom', 'collab', null, null, 'Custom UGC package', 0, 'USD', true, true),
  -- Collab: Bundles
  ('Buzz Bundle', 'bundle', 'collab', 10, 4, '4 UGC, 10 influencer videos', 0, 'USD', false, true),
  ('Hype Bundle', 'bundle', 'collab', 15, 8, '8 UGC, 15 influencer videos', 0, 'USD', false, true),
  ('Impact Bundle', 'bundle', 'collab', 25, 12, '12 UGC, 25 influencer videos', 0, 'USD', false, true),
  ('Viral Campaign', 'bundle', 'collab', 40, 20, '20 UGC, 40 influencer videos', 0, 'USD', false, true),

  -- Paid: Influencer packages
  ('Influencer 10 Videos', 'influencer', 'paid', 10, null, null, 0, 'USD', false, true),
  ('Influencer 15 Videos', 'influencer', 'paid', 15, null, null, 0, 'USD', false, true),
  ('Influencer 20 Videos', 'influencer', 'paid', 20, null, null, 0, 'USD', false, true),
  ('Influencer 40 Videos', 'influencer', 'paid', 40, null, null, 0, 'USD', false, true),
  ('Influencer Other', 'custom', 'paid', null, null, 'Custom influencer package', 0, 'USD', true, true),
  -- Paid: UGC packages
  ('UGC 4 Videos', 'ugc', 'paid', null, 4, null, 0, 'USD', false, true),
  ('UGC 8 Videos', 'ugc', 'paid', null, 8, null, 0, 'USD', false, true),
  ('UGC 12 Videos', 'ugc', 'paid', null, 12, null, 0, 'USD', false, true),
  ('UGC 20 Videos', 'ugc', 'paid', null, 20, null, 0, 'USD', false, true),
  ('UGC Other', 'custom', 'paid', null, null, 'Custom UGC package', 0, 'USD', true, true),
  -- Paid: Bundles
  ('Buzz Bundle', 'bundle', 'paid', 10, 4, '4 UGC, 10 influencer videos', 0, 'USD', false, true),
  ('Hype Bundle', 'bundle', 'paid', 15, 8, '8 UGC, 15 influencer videos', 0, 'USD', false, true),
  ('Impact Bundle', 'bundle', 'paid', 25, 12, '12 UGC, 25 influencer videos', 0, 'USD', false, true),
  ('Viral Campaign', 'bundle', 'paid', 40, 20, '20 UGC, 40 influencer videos', 0, 'USD', false, true),

  -- Mix: Influencer packages
  ('Influencer 10 Videos', 'influencer', 'mix', 10, null, null, 0, 'USD', false, true),
  ('Influencer 15 Videos', 'influencer', 'mix', 15, null, null, 0, 'USD', false, true),
  ('Influencer 20 Videos', 'influencer', 'mix', 20, null, null, 0, 'USD', false, true),
  ('Influencer 40 Videos', 'influencer', 'mix', 40, null, null, 0, 'USD', false, true),
  ('Influencer Other', 'custom', 'mix', null, null, 'Custom influencer package', 0, 'USD', true, true),
  -- Mix: UGC packages
  ('UGC 4 Videos', 'ugc', 'mix', null, 4, null, 0, 'USD', false, true),
  ('UGC 8 Videos', 'ugc', 'mix', null, 8, null, 0, 'USD', false, true),
  ('UGC 12 Videos', 'ugc', 'mix', null, 12, null, 0, 'USD', false, true),
  ('UGC 20 Videos', 'ugc', 'mix', null, 20, null, 0, 'USD', false, true),
  ('UGC Other', 'custom', 'mix', null, null, 'Custom UGC package', 0, 'USD', true, true),
  -- Mix: Bundles
  ('Buzz Bundle', 'bundle', 'mix', 10, 4, '4 UGC, 10 influencer videos', 0, 'USD', false, true),
  ('Hype Bundle', 'bundle', 'mix', 15, 8, '8 UGC, 15 influencer videos', 0, 'USD', false, true),
  ('Impact Bundle', 'bundle', 'mix', 25, 12, '12 UGC, 25 influencer videos', 0, 'USD', false, true),
  ('Viral Campaign', 'bundle', 'mix', 40, 20, '20 UGC, 40 influencer videos', 0, 'USD', false, true);
