-- Add account column to meta_insights for multi-account support
ALTER TABLE public.meta_insights
  ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'fratellihouse';

ALTER TABLE public.meta_insights
  DROP CONSTRAINT IF EXISTS meta_insights_date_campaign_id_adset_id_ad_id_key;

ALTER TABLE public.meta_insights
  ADD CONSTRAINT meta_insights_unique
  UNIQUE (date, campaign_id, adset_id, ad_id, account);

-- Add account column to meta_ads_conversions is not needed:
-- phone_company field already distinguishes Fratelli House vs FratelliRev
