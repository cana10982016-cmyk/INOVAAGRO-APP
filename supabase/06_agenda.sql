-- INOVAAGRO: Agenda da equipe (visitas planejadas por técnico e por semana).
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- Permissões:
--   Administrador: vê, agenda, muda e exclui as visitas de toda a equipe.
--   Técnico: vê, agenda, muda e exclui só as visitas da própria agenda (campo "tecnico" = e-mail dele).
--   Consulta: vê só a própria agenda e não altera nada.

create table if not exists agenda (
  id text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
alter table agenda enable row level security;
grant select, insert, update, delete on agenda to authenticated;
revoke all on agenda from anon;

create or replace function agenda_minha(d jsonb) returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(d ->> 'tecnico', '')) = lower(coalesce(auth.jwt() ->> 'email', '-'));
$$;
grant execute on function agenda_minha(jsonb) to authenticated;

drop policy if exists agenda_ler on agenda;
drop policy if exists agenda_incluir on agenda;
drop policy if exists agenda_alterar on agenda;
drop policy if exists agenda_excluir on agenda;
create policy agenda_ler on agenda for select to authenticated
  using (sou_admin() or (sou_membro() and agenda_minha(dados)));
create policy agenda_incluir on agenda for insert to authenticated
  with check (sou_admin() or (posso_editar() and agenda_minha(dados)));
create policy agenda_alterar on agenda for update to authenticated
  using (sou_admin() or (posso_editar() and agenda_minha(dados)))
  with check (sou_admin() or (posso_editar() and agenda_minha(dados)));
create policy agenda_excluir on agenda for delete to authenticated
  using (sou_admin() or (posso_editar() and agenda_minha(dados)));

-- busca rápida por técnico e por data
create index if not exists agenda_tecnico_data on agenda ((lower(dados ->> 'tecnico')), (dados ->> 'data'));
