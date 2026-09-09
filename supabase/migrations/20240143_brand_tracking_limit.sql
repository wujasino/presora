-- Caps how many *distinct* brands a user can track, per plan (pricing page
-- feedback: "how many brands/domains can I monitor at this price?" had no
-- real answer — analyses_this_month only capped total scan volume, not the
-- number of different brands spread across them). Free/Starter/Solo: 1,
-- Business: 5, Agency: 25 — matches src/lib/plans.ts' `maxBrands`.
--
-- Re-scanning a brand the user already has at least one analysis for is
-- always allowed regardless of this cap; only *starting* a brand-new one
-- once already at the limit is blocked. Existing accounts that already
-- exceed their plan's new cap keep every existing brand queryable/
-- re-scannable — only adding another new one going forward is affected.
--
-- brand_key() mirrors src/lib/analyses.ts' brandKey() exactly (same
-- normalization steps, same order) so "presora", "Presora.app" and
-- "https://www.presora.app/" count as one brand here too.
CREATE OR REPLACE FUNCTION public.brand_key(raw text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(trim(coalesce(raw, ''))),
              '^https?://', ''
            ),
            '^www\.', ''
          ),
          '/.*$', ''
        ),
        '\.(com|net|org|io|app|co|ai|dev|xyz|pl|eu|de|fr|es|it|uk)$', ''
      ),
      '\s+', ' ', 'g'
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.enforce_analysis_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_plan           TEXT;
  analysis_count      INT;
  plan_limit          INT;
  last_reset          TIMESTAMPTZ;
  max_brands          INT;
  new_brand_key       TEXT;
  is_new_brand        BOOLEAN;
  existing_brand_count INT;
BEGIN
  SELECT plan, analyses_this_month, analyses_reset_at
  INTO user_plan, analysis_count, last_reset
  FROM public.profiles WHERE id = NEW.user_id;

  -- Scoped to this transaction only (set_config's third arg = true / "is
  -- local"); Postgres reverts it automatically at COMMIT or ROLLBACK, so
  -- there is nothing to reset by hand and no way it leaks into another
  -- request's transaction.
  PERFORM set_config('presora.internal_usage_write', 'on', true);

  IF last_reset IS NULL OR last_reset < date_trunc('month', now()) THEN
    UPDATE public.profiles
    SET analyses_this_month = 0, analyses_reset_at = now()
    WHERE id = NEW.user_id;
    analysis_count := 0;
  END IF;

  plan_limit := CASE user_plan
    WHEN 'free'         THEN 3
    WHEN 'starter'      THEN 5
    WHEN 'solo'         THEN 10
    WHEN 'growth'       THEN 50
    WHEN 'enterprise'   THEN 999999
    WHEN 'agency'       THEN 999999
    ELSE 3
  END;

  IF analysis_count >= plan_limit THEN
    RAISE EXCEPTION 'Analysis limit reached for plan: %', COALESCE(user_plan, 'free');
  END IF;

  max_brands := CASE user_plan
    WHEN 'free'         THEN 1
    WHEN 'starter'      THEN 1
    WHEN 'solo'         THEN 1
    WHEN 'growth'       THEN 5
    WHEN 'enterprise'   THEN 25
    WHEN 'agency'       THEN 25
    ELSE 1
  END;

  new_brand_key := public.brand_key(NEW.brand_name);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.analyses
    WHERE user_id = NEW.user_id AND public.brand_key(brand_name) = new_brand_key
  ) INTO is_new_brand;

  IF is_new_brand THEN
    SELECT COUNT(DISTINCT public.brand_key(brand_name)) INTO existing_brand_count
    FROM public.analyses WHERE user_id = NEW.user_id;

    IF existing_brand_count >= max_brands THEN
      RAISE EXCEPTION 'Brand limit reached for plan: % (max % tracked brand(s))', COALESCE(user_plan, 'free'), max_brands;
    END IF;
  END IF;

  UPDATE public.profiles
  SET analyses_this_month = analyses_this_month + 1
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$function$;
