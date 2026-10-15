-- Close accidental public access to contact messages. The contact Netlify
-- Function uses the service role; browser roles never need direct access.
alter table public.contact_messages enable row level security;

drop policy if exists "Enable read access for all users"
  on public.contact_messages;
drop policy if exists "service role only"
  on public.contact_messages;
drop policy if exists "Service role manages contact messages"
  on public.contact_messages;

revoke all on table public.contact_messages from public, anon, authenticated;
grant select, insert, delete on table public.contact_messages to service_role;

create policy "Service role manages contact messages"
  on public.contact_messages
  for all
  to service_role
  using (true)
  with check (true);

-- Index foreign keys used by joins, ownership lookups, and cascading deletes.
create index if not exists api_key_usage_user_id_idx
  on public.api_key_usage (user_id);
create index if not exists app_settings_updated_by_idx
  on public.app_settings (updated_by);
create index if not exists credit_code_redemptions_user_id_idx
  on public.credit_code_redemptions (user_id);
create index if not exists credit_codes_created_by_idx
  on public.credit_codes (created_by);
create index if not exists report_shares_owner_id_idx
  on public.report_shares (owner_id);
create index if not exists temporary_access_grants_granted_by_idx
  on public.temporary_access_grants (granted_by);
create index if not exists webhook_deliveries_user_id_idx
  on public.webhook_deliveries (user_id);

-- Cache auth.uid() once per statement and make the intended role explicit.
drop policy if exists "User can delete their own notifications"
  on public.notifications;
create policy "User can delete their own notifications"
  on public.notifications
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "User can view their own api key usage"
  on public.api_key_usage;
create policy "User can view their own api key usage"
  on public.api_key_usage
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "User can view their own api keys"
  on public.api_keys;
create policy "User can view their own api keys"
  on public.api_keys
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "User can view their own webhook deliveries"
  on public.webhook_deliveries;
create policy "User can view their own webhook deliveries"
  on public.webhook_deliveries
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "User can view their own webhooks"
  on public.webhooks;
create policy "User can view their own webhooks"
  on public.webhooks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users manage their own tracked competitors"
  on public.tracked_competitors;
create policy "Users manage their own tracked competitors"
  on public.tracked_competitors
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
