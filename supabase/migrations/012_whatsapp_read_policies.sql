-- [FH]conversation_Whatsapp and phones_team_fratelli were created outside this
-- app (external WhatsApp integration) with RLS enabled but zero policies —
-- that blocks all access, including the authenticated role this app's
-- Supabase client uses. Read-only, additive: doesn't touch whatever writes
-- into these tables today.
create policy "Authenticated read conversation_whatsapp"
  on public."[FH]conversation_Whatsapp" for select
  to authenticated using (true);

create policy "Authenticated read phones_team_fratelli"
  on public.phones_team_fratelli for select
  to authenticated using (true);
