-- The client's own Zernio profile, created on first use. Never share one profile between clients.
alter table app_settings add column if not exists zernio_profile_id text;
