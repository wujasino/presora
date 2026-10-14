CREATE TABLE IF NOT EXISTS public.credit_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE
    CHECK (code = upper(code) AND code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  credits_per_redemption INTEGER NOT NULL CHECK (credits_per_redemption BETWEEN 1 AND 100000),
  max_redemptions INTEGER NOT NULL CHECK (max_redemptions > 0),
  redemption_count INTEGER NOT NULL DEFAULT 0
    CHECK (redemption_count >= 0 AND redemption_count <= max_redemptions),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES public.credit_codes(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_session_id TEXT NOT NULL UNIQUE,
  credits_awarded INTEGER NOT NULL CHECK (credits_awarded > 0),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS credit_code_redemptions_code_id_idx
  ON public.credit_code_redemptions (code_id);

CREATE INDEX IF NOT EXISTS credit_code_redemptions_user_id_idx
  ON public.credit_code_redemptions (user_id);

CREATE INDEX IF NOT EXISTS credit_codes_created_by_idx
  ON public.credit_codes (created_by);

ALTER TABLE public.credit_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on credit_codes" ON public.credit_codes;
DROP POLICY IF EXISTS "Service role full access on credit_code_redemptions" ON public.credit_code_redemptions;

REVOKE ALL ON TABLE public.credit_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.credit_code_redemptions FROM anon, authenticated;
GRANT ALL ON TABLE public.credit_codes TO service_role;
GRANT ALL ON TABLE public.credit_code_redemptions TO service_role;

CREATE POLICY "Service role full access on credit_codes"
  ON public.credit_codes FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on credit_code_redemptions"
  ON public.credit_code_redemptions FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP FUNCTION IF EXISTS public.redeem_credit_code(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.redeem_credit_code(
  p_code TEXT,
  p_user_id UUID,
  p_checkout_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_code public.credit_codes%ROWTYPE;
  v_status TEXT;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_user_id IS NULL OR p_checkout_session_id IS NULL OR btrim(p_checkout_session_id) = '' OR length(p_checkout_session_id) > 255 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
  ) THEN
    RETURN jsonb_build_object('status', 'account_not_found');
  END IF;

  SELECT * INTO v_code
  FROM public.credit_codes
  WHERE code = upper(btrim(p_code))
  FOR UPDATE;

  IF NOT FOUND OR NOT v_code.is_active THEN
    RETURN jsonb_build_object('status', 'invalid_or_inactive');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_code_redemptions
    WHERE checkout_session_id = p_checkout_session_id
  ) THEN
    v_status := 'already_processed';
  ELSIF EXISTS (
    SELECT 1
    FROM public.credit_code_redemptions
    WHERE code_id = v_code.id AND user_id = p_user_id
  ) THEN
    v_status := 'already_used';
  ELSIF v_code.redemption_count >= v_code.max_redemptions THEN
    v_status := 'limit_reached';
  END IF;

  IF v_status IS NOT NULL THEN
    RETURN jsonb_build_object('status', v_status);
  END IF;

  INSERT INTO public.credit_code_redemptions (
    code_id,
    user_id,
    checkout_session_id,
    credits_awarded
  )
  VALUES (
    v_code.id,
    p_user_id,
    p_checkout_session_id,
    v_code.credits_per_redemption
  );

  UPDATE public.credit_codes
  SET redemption_count = redemption_count + 1
  WHERE id = v_code.id;

  UPDATE public.profiles
  SET credits = credits + v_code.credits_per_redemption,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'status', 'redeemed',
    'credits', v_code.credits_per_redemption
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.redeem_credit_code(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_credit_code(TEXT, UUID, TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public.report_shares (
  analysis_id UUID PRIMARY KEY REFERENCES public.analyses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on report_shares" ON public.report_shares;
DROP POLICY IF EXISTS "Users can view own report shares" ON public.report_shares;
DROP POLICY IF EXISTS "Users can insert own report shares" ON public.report_shares;
DROP POLICY IF EXISTS "Users can update own report shares" ON public.report_shares;
DROP POLICY IF EXISTS "Users can delete own report shares" ON public.report_shares;

REVOKE ALL ON TABLE public.report_shares FROM anon, authenticated;
GRANT ALL ON TABLE public.report_shares TO service_role;

CREATE POLICY "Service role full access on report_shares"
  ON public.report_shares FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS report_shares_owner_id_idx
  ON public.report_shares (owner_id);

CREATE INDEX IF NOT EXISTS report_shares_created_at_idx
  ON public.report_shares (created_at DESC);
