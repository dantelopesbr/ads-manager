# Backlog

Mantido durante o desenvolvimento — atualizar quando um item for resolvido ou um novo surgir.

## Decisões pendentes do Dante

- **Projeto Vercel duplicado `ads-manage`** (`prj_BYjOEmwRzPW6qapX2TBbIS0nT26U`) — sem env vars, quebrado (500 ao testar). Não deletado ainda, aguardando confirmação. Projeto correto é `ads-manager` (`prj_lGbX0eZ0R5pqx5WpgoISKN3j58oy`), branch de produção já corrigido pra `main`.
- **Estrutura de decisão de criativos/campanhas** — Dante quer cruzar dado de venda fechada por criativo (já dá pra fazer, precisa nomenclatura consistente no Meta Ads Manager) + engajamento orgânico do Instagram (sem integração ainda). Só discutido como conselho, não desenhado nem implementado.

## Dívida técnica conhecida

- **Tabela "Vendedor/Leads/Deals" (topo de `/vendedores`)** ainda mostra boa parte dos leads como "Sem vendedor" mesmo após a migration 019 (fallback pra `[FH]telefone_vendedor`) — pode ser legítimo (lead sem contato HubSpot ainda) ou pipeline incompleto. Não investigado a fundo.
- **Fonte custom "Brasley"** do site principal não está nesse app — usando fallback documentado (Inter/Montserrat). Se quiser fidelidade total, pegar os arquivos woff2 com o Dante/repo do site.
- Lint pré-existente, não tocado: `components/account-switcher.tsx` (cookie assignment fora de effect), `components/nav.tsx` (setState síncrono em effect), ternário-como-statement em `campaigns-table.tsx`/`vendor-activity-log.tsx`.
- Meta mensal (`[FH]meta_vendedor_mensal`) só populada até jul/2027 — revisitar antes de acabar.

## Ideias levantadas, não decididas

- Cruzar Instagram orgânico (engajamento por tema/formato) como validação de criativo antes de escalar em mídia paga.
- Ranquear criativos por venda fechada (não só CPL) — depende de nomenclatura consistente de campanha/anúncio no Meta Ads Manager.
