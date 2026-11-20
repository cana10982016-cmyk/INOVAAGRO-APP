-- INOVAAGRO: atualização do banco (rodar no editor SQL do Supabase; pode rodar de novo sem problema)
-- 1) equipe e permissões  2) tabelas dos módulos novos (insumos, máquinas, chuvas, silobolsas etc.)
-- Papéis: admin (tudo + equipe), editor (cadastra e edita), leitura (só consulta).

alter table membros add column if not exists nome text;
alter table membros add column if not exists ativo boolean not null default true;
update membros set papel = 'editor' where papel is null or papel not in ('admin', 'editor', 'leitura');
alter table membros alter column papel set default 'editor';
alter table membros drop constraint if exists membros_papel_ok;
alter table membros add constraint membros_papel_ok check (papel in ('admin', 'editor', 'leitura'));
-- o primeiro cadastrado vira administrador se ainda não houver nenhum
update membros set papel = 'admin'
 where email = (select email from membros order by criado_em nulls last, email limit 1)
   and not exists (select 1 from membros where papel = 'admin');

create or replace function meu_papel() returns text language sql stable security definer set search_path = public as $$
  select papel from membros where lower(email) = lower(auth.jwt() ->> 'email') and ativo limit 1;
$$;
create or replace function sou_membro() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where lower(email) = lower(auth.jwt() ->> 'email') and ativo);
$$;
create or replace function posso_editar() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(meu_papel() in ('admin', 'editor'), false);
$$;
create or replace function sou_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(meu_papel() = 'admin', false);
$$;
grant execute on function meu_papel(), sou_membro(), posso_editar(), sou_admin() to authenticated;

-- Dados: todos da equipe leem; só admin e técnico gravam.
do $$
declare t text;
begin
  foreach t in array array['produtores','fazendas','talhoes','safras','monitoramentos','ordens',
                           'insumos','maquinas','aplicadores','depositos','silobolsas','avancos','controles','armadilhas','pluviometros','chuvas','etiquetas'] loop
    execute format('create table if not exists %I (id text primary key, dados jsonb not null, atualizado_em timestamptz not null default now(), atualizado_por uuid default auth.uid())', t);
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('drop policy if exists membros_tudo on %I', t);
    execute format('drop policy if exists equipe_ler on %I', t);
    execute format('drop policy if exists equipe_incluir on %I', t);
    execute format('drop policy if exists equipe_alterar on %I', t);
    execute format('drop policy if exists equipe_excluir on %I', t);
    execute format('create policy equipe_ler on %I for select to authenticated using (sou_membro())', t);
    execute format('create policy equipe_incluir on %I for insert to authenticated with check (posso_editar())', t);
    execute format('create policy equipe_alterar on %I for update to authenticated using (posso_editar()) with check (posso_editar())', t);
    execute format('create policy equipe_excluir on %I for delete to authenticated using (posso_editar())', t);
  end loop;
end $$;

-- Membros: a equipe vê a lista; só administrador inclui, altera e remove.
alter table membros enable row level security;
drop policy if exists membros_ler on membros;
drop policy if exists membros_admin_incluir on membros;
drop policy if exists membros_admin_alterar on membros;
drop policy if exists membros_admin_excluir on membros;
create policy membros_ler on membros for select to authenticated using (sou_membro());
create policy membros_admin_incluir on membros for insert to authenticated with check (sou_admin());
create policy membros_admin_alterar on membros for update to authenticated using (sou_admin()) with check (sou_admin());
create policy membros_admin_excluir on membros for delete to authenticated using (sou_admin());
grant select, insert, update, delete on membros to authenticated;

-- Segurança: nunca deixar o sistema sem um administrador ativo.
create or replace function membros_manter_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from membros where papel = 'admin' and ativo) then
    raise exception 'Precisa existir pelo menos um administrador ativo (ultimo admin)';
  end if;
  return null;
end $$;
drop trigger if exists membros_manter_admin on membros;
create constraint trigger membros_manter_admin after update or delete on membros
  deferrable initially deferred for each row execute function membros_manter_admin();

-- Permissões por fazenda: se a lista "fazendas" do membro estiver vazia, ele vê todas.
-- Administrador sempre vê tudo.
alter table membros add column if not exists fazendas text[];
create or replace function minhas_fazendas() returns text[] language sql stable security definer set search_path = public as $$
  select case when m.papel = 'admin' or m.fazendas is null or cardinality(m.fazendas) = 0 then null else m.fazendas end
    from membros m where lower(m.email) = lower(auth.jwt() ->> 'email') and m.ativo limit 1;
$$;
create or replace function pode_ver(t text, rid text, d jsonb) returns boolean language plpgsql stable security definer set search_path = public as $$
declare f text[] := minhas_fazendas();
begin
  if f is null then return true; end if;
  if t = 'fazendas' then return rid = any(f); end if;
  if t = 'produtores' then return exists (select 1 from fazendas z where z.dados ->> 'produtor_id' = rid and z.id = any(f)); end if;
  if d ->> 'fazenda_id' is not null then return d ->> 'fazenda_id' = any(f); end if;
  if d ->> 'talhao_id' is not null then return exists (select 1 from talhoes x where x.id = d ->> 'talhao_id' and x.dados ->> 'fazenda_id' = any(f)); end if;
  if t = 'chuvas' and d ->> 'pluviometro_id' is not null then
    return exists (select 1 from pluviometros p where p.id = d ->> 'pluviometro_id' and (p.dados ->> 'fazenda_id' is null or p.dados ->> 'fazenda_id' = any(f)));
  end if;
  return t in ('insumos', 'maquinas', 'aplicadores', 'etiquetas', 'depositos', 'pluviometros', 'chuvas', 'silobolsas', 'armadilhas');
end $$;
grant execute on function minhas_fazendas(), pode_ver(text, text, jsonb) to authenticated;
do $$
declare t text;
begin
  foreach t in array array['produtores','fazendas','talhoes','safras','monitoramentos','ordens',
                           'insumos','maquinas','aplicadores','depositos','silobolsas','avancos','controles','armadilhas','pluviometros','chuvas','etiquetas'] loop
    execute format('drop policy if exists equipe_ler on %I', t);
    execute format('drop policy if exists equipe_incluir on %I', t);
    execute format('drop policy if exists equipe_alterar on %I', t);
    execute format('drop policy if exists equipe_excluir on %I', t);
    execute format('create policy equipe_ler on %I for select to authenticated using (sou_membro() and pode_ver(%L, id, dados))', t, t);
    execute format('create policy equipe_incluir on %I for insert to authenticated with check (posso_editar() and pode_ver(%L, id, dados))', t, t);
    execute format('create policy equipe_alterar on %I for update to authenticated using (posso_editar() and pode_ver(%L, id, dados)) with check (posso_editar() and pode_ver(%L, id, dados))', t, t, t);
    execute format('create policy equipe_excluir on %I for delete to authenticated using (posso_editar() and pode_ver(%L, id, dados))', t, t);
  end loop;
end $$;
