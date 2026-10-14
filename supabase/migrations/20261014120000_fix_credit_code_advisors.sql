-- Follow-up for projects where 20261014083007 was already applied.
-- These tables are server-only: Netlify verifies the signed-in user and admin
-- status before using a service-role client. Browser roles need no table access.

alter table public.credit_codes enable row level security;
alter table public.credit_code_redemptions enable row level security;
alter table public.report_shares enable row level security;

revoke all on table public.credit_codes from anon, authenticated;
revoke all on table public.credit_code_redemptions from anon, authenticated;
revoke all on table public.report_shares from anon, authenticated;

grant select, insert, update on table public.credit_codes to service_role;
grant select, insert on table public.credit_code_redemptions to service_role;
grant select, insert, update, delete on table public.report_shares to service_role;

-- service_role bypasses RLS. Always-true policies add no protection and can be
-- reported by Advisors, so remove both those policies and the unsafe browser
-- policies from earlier drafts.
drop policy if exists "Service role full access on credit_codes" on public.credit_codes;
drop policy if exists "Service role full access on credit_code_redemptions" on public.credit_code_redemptions;
drop policy if exists "Service role full access on report_shares" on public.report_shares;
drop policy if exists "Users can view own report shares" on public.report_shares;
drop policy if exists "Users can insert own report shares" on public.report_shares;
drop policy if exists "Users can update own report shares" on public.report_shares;
drop policy if exists "Users can delete own report shares" on public.report_shares;

-- Lock the privileged RPC to the server role and pin its lookup path.
alter function public.redeem_credit_code(text, uuid, text) set search_path to '';
revoke all on function public.redeem_credit_code(text, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_credit_code(text, uuid, text) to service_role;

-- Index every foreign-key column used by deletes, joins, or ownership lookups.
create index if not exists credit_code_redemptions_user_id_idx
  on public.credit_code_redemptions (user_id);

create index if not exists credit_codes_created_by_idx
  on public.credit_codes (created_by);

create index if not exists report_shares_owner_id_idx
  on public.report_shares (owner_id);

-- UNIQUE (code_id, user_id) already provides a left-prefix index for code_id.
drop index if exists public.credit_code_redemptions_code_id_idx;

-- No production query filters or sorts report shares by creation time.
drop index if exists public.report_shares_created_at_idx;
