create table if not exists public.reputation_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  monitor_id uuid references public.brand_monitors(id) on delete cascade,
  brand_name text not null check (char_length(btrim(brand_name)) between 1 and 160),
  incident_type text not null check (incident_type in (
    'low_visibility',
    'score_drop',
    'low_accuracy',
    'model_uncertainty',
    'competitor_gap'
  )),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 1200),
  recommended_action text not null check (char_length(recommended_action) between 1 and 1200),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 220),
  first_detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists reputation_incidents_user_id_idx
  on public.reputation_incidents (user_id);

create index if not exists reputation_incidents_analysis_id_idx
  on public.reputation_incidents (analysis_id)
  where analysis_id is not null;

create index if not exists reputation_incidents_monitor_id_idx
  on public.reputation_incidents (monitor_id)
  where monitor_id is not null;

create index if not exists reputation_incidents_open_user_seen_idx
  on public.reputation_incidents (user_id, last_seen_at desc)
  where status = 'open';

alter table public.reputation_incidents enable row level security;

revoke all on table public.reputation_incidents from anon, authenticated;
grant select on table public.reputation_incidents to authenticated;
grant all on table public.reputation_incidents to service_role;

drop policy if exists "Users can view own reputation incidents" on public.reputation_incidents;
drop policy if exists "Service role manages reputation incidents" on public.reputation_incidents;

create policy "Users can view own reputation incidents"
  on public.reputation_incidents
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Service role manages reputation incidents"
  on public.reputation_incidents
  for all
  to service_role
  using (true)
  with check (true);
