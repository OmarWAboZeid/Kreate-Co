alter table identities rename to users;

alter table users rename column full_name to name;

alter table users
  add column password_hash text not null default '',
  add column role text not null default 'brand' check (role in ('admin', 'brand', 'creator')),
  add column status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'));

create table if not exists sessions (
  id text primary key,
  user_id uuid references users(id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);
