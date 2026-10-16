create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  media_id uuid not null references media (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'published', 'partial', 'failed')),
  publish_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_posts_status on posts (status);
create index idx_posts_publish_at on posts (publish_at);
create index idx_posts_created_at on posts (created_at desc);

create table if not exists post_targets (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts (id) on delete cascade,
  platform text not null,
  account_id text not null,
  account_name text not null,
  caption text not null default '',
  provider text not null default 'upload-post',
  status text not null default 'pending' check (status in ('pending', 'sending', 'published', 'failed')),
  provider_ref text,
  url text,
  error text,
  unique (post_id, platform, account_id)
);

create index idx_post_targets_post_id on post_targets (post_id);
