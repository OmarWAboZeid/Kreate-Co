CREATE TABLE IF NOT EXISTS organization_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_chat_messages_organization_id_idx
  ON organization_chat_messages(organization_id, created_at);

CREATE TABLE IF NOT EXISTS organization_chat_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES organization_chat_messages(id) ON DELETE CASCADE,
  object_path text NOT NULL CHECK (object_path LIKE '/objects/%'),
  file_name text NOT NULL,
  content_type text,
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_chat_message_attachments_message_id_idx
  ON organization_chat_message_attachments(message_id, sort_order, created_at);
