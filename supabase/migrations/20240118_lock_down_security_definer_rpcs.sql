-- Found via Supabase's security advisors (mcp get_advisors): every
-- SECURITY DEFINER function in `public` had EXECUTE still granted to
-- PUBLIC (the Postgres default for newly created functions), which means
-- anon/authenticated could call each one directly via PostgREST RPC
-- (/rest/v1/rpc/<name>) — bypassing whatever the calling Netlify function
-- normally validates first.
--
-- Two of these are real, exploitable vulnerabilities, not just hygiene:
--   - increment_credits(user_id, amount): no ownership check at all — any
--     signed-in user could call it with any user_id/amount and grant
--     themselves (or anyone) unlimited free credits, bypassing Stripe.
--   - match_brand_knowledge(..., p_user_id, ...): filters by p_user_id but
--     never checks it against auth.uid() — any signed-in user could pass
--     someone else's id and read that user's private brand_knowledge rows,
--     defeating the table's own RLS policy.
--
-- None of these functions are ever called from client-side code (checked:
-- only netlify/functions/*.js call them, always via the service-role
-- admin client) — service_role bypasses RLS/grants regardless, so
-- revoking PUBLIC execute here breaks nothing legitimate.

revoke execute on function public.increment_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.match_brand_knowledge(public.vector, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.increment_guest_limit(text) from public, anon, authenticated;
revoke execute on function public.register_otp_attempt(text) from public, anon, authenticated;
revoke execute on function public.cleanup_expired_otps() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Trigger functions — never meant to be called directly at all (they read
-- NEW/OLD/TG_OP, which only exist in real trigger context), but still had
-- PUBLIC execute by default.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.enforce_analysis_limit()') is not null then
    execute 'revoke execute on function public.enforce_analysis_limit() from public, anon, authenticated';
  end if;
end;
$$;
revoke execute on function public.protect_plan_changes() from public, anon, authenticated;

grant execute on function public.increment_credits(uuid, integer) to service_role;
grant execute on function public.match_brand_knowledge(public.vector, uuid, integer, text) to service_role;
grant execute on function public.increment_guest_limit(text) to service_role;
grant execute on function public.register_otp_attempt(text) to service_role;
grant execute on function public.cleanup_expired_otps() to service_role;
