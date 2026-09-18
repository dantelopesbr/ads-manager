-- Read-only tables populated daily by an external n8n workflow. Same pattern
-- as [FH]conversation_Whatsapp / phones_team_fratelli (012): created outside
-- this app, RLS likely enabled with zero policies, which blocks this app's
-- authenticated client entirely. Read-only policies only — nothing here
-- writes to these tables.
create policy "Authenticated read atividade_vendedor_resumo_diario"
  on public."[FH]atividade_vendedor_resumo_diario" for select
  to authenticated using (true);

create policy "Authenticated read atividade_vendedor_log"
  on public."[FH]atividade_vendedor_log" for select
  to authenticated using (true);

create policy "Authenticated read parceiro_status_log"
  on public."[FH]parceiro_status_log" for select
  to authenticated using (true);
