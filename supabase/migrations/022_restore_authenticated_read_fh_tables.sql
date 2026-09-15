-- Regression from the security remediation (migrations 020/021 + the
-- external RLS lockdown the arquitetos-vendedores team did on their own
-- [FH] tables afterward): these 4 tables got RLS enabled with zero policies
-- at all, not just tightened writes — fail-closed also blocked this app's
-- own `authenticated` reads, which every diagnostic in that remediation
-- missed because it used the service_role key (bypasses RLS regardless of
-- policy). Confirmed broken live: /vendedores/[vendedor] showed "Meta: não
-- definida" and zero orçamentos for real vendors with real August 2026 data.
--
-- Read-only policy, matching the pattern already used successfully on the
-- sibling [FH] tables (atividade_vendedor_resumo_diario, deal_motivo_fechamento,
-- lead_canal_vendedor, speed_to_lead_vendedor_diario).
create policy "Authenticated read performance_vendedor_diario"
  on public."[FH]performance_vendedor_diario" for select
  to authenticated using (true);

create policy "Authenticated read meta_vendedor_mensal"
  on public."[FH]meta_vendedor_mensal" for select
  to authenticated using (true);

create policy "Authenticated read funil_vendedor_diario"
  on public."[FH]funil_vendedor_diario" for select
  to authenticated using (true);

create policy "Authenticated read telefone_vendedor"
  on public."[FH]telefone_vendedor" for select
  to authenticated using (true);
