-- Pricing update: Solo goes from 10 to 15 analyses/month and from 1 to 2
-- tracked brands. Business's price changes ($89.99 -> $99.00) but its
-- limits (50 analyses, 5 brands) are unchanged, so no CASE branch there
-- needs touching. Same two functions as migrations 20240112/20240143 —
-- re-declaring both in full since CREATE OR REPLACE requires the whole
-- function body, not a diff.
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
    WHEN 'solo'         THEN 15
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
    WHEN 'solo'         THEN 2
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
