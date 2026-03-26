alter table users
  add column if not exists email_verified_at timestamptz,
  add column if not exists email_verification_token_hash text,
  add column if not exists email_verification_sent_at timestamptz,
  add column if not exists email_verification_expires_at timestamptz;

create index if not exists users_email_verification_token_hash_idx
  on users(email_verification_token_hash);

update users
set email_verified_at = coalesce(email_verified_at, created_at, now())
where email_verified_at is null
  and status = 'approved';

update users
set email_verified_at = coalesce(email_verified_at, created_at, now())
where email_verified_at is null
  and role in ('admin', 'creator');
