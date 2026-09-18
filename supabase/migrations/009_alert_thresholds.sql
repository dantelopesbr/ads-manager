-- Alert thresholds were hardcoded (CPL > 1.5x account average, CTR < 0.3%)
-- in lib/alerts/check.ts. Move them into account_targets — same per-account
-- settings table already editable from Settings — so each account can tune
-- its own sensitivity without a code change.
alter table public.account_targets
  add column if not exists cpl_alert_multiplier numeric(4,2) not null default 1.5,
  add column if not exists ctr_alert_min numeric(6,4) not null default 0.003;
