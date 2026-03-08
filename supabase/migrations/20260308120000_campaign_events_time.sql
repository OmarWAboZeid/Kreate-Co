alter table campaign_events
  add column if not exists event_time time;

create index if not exists campaign_events_campaign_id_date_time_idx
  on campaign_events(campaign_id, event_date, event_time, created_at);
