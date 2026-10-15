-- Server-side frequency cap and idempotency for lifecycle email triggers.
-- The browser never reads or writes this table; Netlify Functions use the
-- service role after verifying the user/event that caused the send.
create table if not exists public.lifecycle_email_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (char_length(event_name) between 1 and 120),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (user_id, event_name, dedupe_key)
);

create index if not exists lifecycle_email_events_user_created_idx
  on public.lifecycle_email_events (user_id, created_at desc);

alter table public.lifecycle_email_events enable row level security;

revoke all on table public.lifecycle_email_events from public, anon, authenticated;
grant all on table public.lifecycle_email_events to service_role;
grant usage, select on sequence public.lifecycle_email_events_id_seq to service_role;

drop policy if exists "Service role manages lifecycle email events" on public.lifecycle_email_events;
create policy "Service role manages lifecycle email events"
  on public.lifecycle_email_events
  for all
  to service_role
  using (true)
  with check (true);
