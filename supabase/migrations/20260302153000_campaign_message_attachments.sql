create table if not exists campaign_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references campaign_messages(id) on delete cascade,
  object_path text not null check (object_path like '/objects/%'),
  file_name text not null,
  content_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists campaign_message_attachments_message_id_idx
  on campaign_message_attachments(message_id, sort_order, created_at);
