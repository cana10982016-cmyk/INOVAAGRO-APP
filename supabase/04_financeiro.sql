-- INOVAAGRO: módulo financeiro (veículos e despesas de combustível, manutenção, alimentação e outras).
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- Permissões:
--   Veículos: toda a equipe vê; administrador e técnico cadastram e alteram; só o administrador exclui.
--   Despesas: o técnico vê, lança e altera só as PRÓPRIAS despesas, enquanto estiverem "Pendente" (ou "Recusada", para corrigir).
--             O administrador vê todas, aprova, recusa e marca como reembolsada.
--   Comprovantes (fotos): guardados em área PRIVADA; cada um vê só os seus, o administrador vê todos.

do $$
declare t text;
begin
  foreach t in array array['veiculos', 'despesas'] loop
    execute format('create table if not exists %I (id text primary key, dados jsonb not null, atualizado_em timestamptz not null default now(), atualizado_por uuid default auth.uid())', t);
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- Veículos
drop policy if exists veic_ler on veiculos;
drop policy if exists veic_incluir on veiculos;
drop policy if exists veic_alterar on veiculos;
drop policy if exists veic_excluir on veiculos;
create policy veic_ler on veiculos for select to authenticated using (sou_membro());
create policy veic_incluir on veiculos for insert to authenticated with check (posso_editar());
create policy veic_alterar on veiculos for update to authenticated using (posso_editar()) with check (posso_editar());
create policy veic_excluir on veiculos for delete to authenticated using (sou_admin());

-- Despesas
create or replace function despesa_minha(d jsonb) returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(d ->> 'usuario', '')) = lower(coalesce(auth.jwt() ->> 'email', '-'));
$$;
grant execute on function despesa_minha(jsonb) to authenticated;

drop policy if exists desp_ler on despesas;
drop policy if exists desp_incluir on despesas;
drop policy if exists desp_alterar on despesas;
drop policy if exists desp_excluir on despesas;
create policy desp_ler on despesas for select to authenticated
  using (sou_admin() or (sou_membro() and despesa_minha(dados)));
create policy desp_incluir on despesas for insert to authenticated
  with check (sou_admin() or (posso_editar() and despesa_minha(dados) and coalesce(dados ->> 'status', 'Pendente') = 'Pendente'));
create policy desp_alterar on despesas for update to authenticated
  using (sou_admin() or (posso_editar() and despesa_minha(dados) and coalesce(dados ->> 'status', 'Pendente') in ('Pendente', 'Recusada')))
  with check (sou_admin() or (posso_editar() and despesa_minha(dados) and coalesce(dados ->> 'status', 'Pendente') = 'Pendente'));
create policy desp_excluir on despesas for delete to authenticated
  using (sou_admin() or (posso_editar() and despesa_minha(dados) and coalesce(dados ->> 'status', 'Pendente') in ('Pendente', 'Recusada')));

-- Comprovantes (fotos de notas e cupons): área privada
insert into storage.buckets (id, name, public, file_size_limit)
values ('comprovantes', 'comprovantes', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = 15728640;

drop policy if exists comprov_enviar on storage.objects;
drop policy if exists comprov_ver on storage.objects;
drop policy if exists comprov_apagar on storage.objects;
create policy comprov_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and public.posso_editar());
create policy comprov_ver on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and (public.sou_admin() or owner_id = auth.uid()::text));
create policy comprov_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and (public.sou_admin() or owner_id = auth.uid()::text));
