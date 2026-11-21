-- INOVAAGRO: Vigor dos talhões por satélite (NDVI do Sentinel-2).
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- Uma linha por talhão com a leitura mais recente e o histórico das leituras.
-- Permissões iguais às dos talhões: a equipe vê (só as fazendas liberadas para cada um); administrador e técnico atualizam.

create table if not exists vigor (
  id text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
alter table vigor enable row level security;
grant select, insert, update, delete on vigor to authenticated;
revoke all on vigor from anon;

drop policy if exists equipe_ler on vigor;
drop policy if exists equipe_incluir on vigor;
drop policy if exists equipe_alterar on vigor;
drop policy if exists equipe_excluir on vigor;
create policy equipe_ler on vigor for select to authenticated using (sou_membro() and pode_ver('vigor', id, dados));
create policy equipe_incluir on vigor for insert to authenticated with check (posso_editar() and pode_ver('vigor', id, dados));
create policy equipe_alterar on vigor for update to authenticated using (posso_editar() and pode_ver('vigor', id, dados)) with check (posso_editar() and pode_ver('vigor', id, dados));
create policy equipe_excluir on vigor for delete to authenticated using (posso_editar() and pode_ver('vigor', id, dados));

-- busca rápida por fazenda
create index if not exists vigor_fazenda on vigor ((dados ->> 'fazenda_id'));
