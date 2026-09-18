-- Add 'action' as valid type for campaign write operations (Phase 2)
alter table public.sync_logs
  drop constraint if exists sync_logs_type_check;

alter table public.sync_logs
  add constraint sync_logs_type_check
  check (type in ('meta', 'hubspot', 'action'));
