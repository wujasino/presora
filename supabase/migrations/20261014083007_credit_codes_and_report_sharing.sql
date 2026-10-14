CREATE TABLE public.credit_codes (
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

CREATE TABLE public.credit_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES public.credit_codes(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_session_id TEXT NOT NULL UNIQUE,
  credits_awarded INTEGER NOT NULL CHECK (credits_awarded > 0),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);

CREATE INDEX credit_code_redemptions_code_id_idx
  ON public.credit_code_redemptions (code_id);

ALTER TABLE public.credit_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_code_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.credit_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.credit_code_redemptions FROM anon, authenticated;
GRANT ALL ON TABLE public.credit_codes TO service_role;
GRANT ALL ON TABLE public.credit_code_redemptions TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_credit_code(
  p_code TEXT,
  p_user_id UUID,
  p_checkout_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_code public.credit_codes%ROWTYPE;
  v_existing_id UUID;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_user_id IS NULL OR p_checkout_session_id IS NULL OR length(p_checkout_session_id) > 255 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT id INTO v_existing_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_existing_id IS NULL THEN
    RETURN jsonb_build_object('status', 'account_not_found');
  END IF;

  SELECT * INTO v_code
  FROM public.credit_codes
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND OR NOT v_code.is_active THEN
    RETURN jsonb_build_object('status', 'invalid_or_inactive');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_code_redemptions
    WHERE checkout_session_id = p_checkout_session_id
  ) THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_code_redemptions
    WHERE code_id = v_code.id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('status', 'already_used');
  END IF;

  IF v_code.redemption_count >= v_code.max_redemptions THEN
    RETURN jsonb_build_object('status', 'limit_reached');
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

CREATE TABLE public.report_shares (
  analysis_id UUID PRIMARY KEY REFERENCES public.analyses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.report_shares FROM anon, authenticated;
GRANT ALL ON TABLE public.report_shares TO service_role;