create table if not exists business_profile (
  id smallint primary key check (id = 1),
  name text not null default '',
  logo_key text,
  website text,
  about text not null default '',
  products jsonb not null default '[]'::jsonb
);

insert into business_profile (id, name, about)
values (1, '', '')
on conflict (id) do nothing;
