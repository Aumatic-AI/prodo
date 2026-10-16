create extension if not exists "uuid-ossp";

create table if not exists media (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('image', 'video', 'text')),
  source text not null check (source in ('generated', 'uploaded')),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  idea text,
  aspect_ratio text check (aspect_ratio in ('1:1', '4:5', '9:16', '16:9')),
  use_logo boolean,
  duration_sec integer check (duration_sec in (15, 30, 45, 60)),
  content text,
  voice_id text,
  storage_key text,
  error text,
  created_at timestamptz not null default now()
);

create index idx_media_type on media (type);
create index idx_media_status on media (status);
create index idx_media_created_at on media (created_at desc);
