-- 0028 · The weekly plan is the owner's choice, and nothing goes out without them by default.
-- app_settings.auto_plan: when on, the Planner plans and makes next week's posts on its own, on the plan day and
-- time. Off by default (also for businesses that already exist): the owner plans from This week (Auto-create,
-- Create an ad) and turns it on in Settings → Automation.
-- autopilot_mode now starts at 'approve_each' (every post waits for the owner); businesses keep their choice.
-- Safe to run once on a database that has 0001–0027.

alter table public.app_settings add column if not exists auto_plan boolean not null default false;
alter table public.app_settings alter column autopilot_mode set default 'approve_each';
