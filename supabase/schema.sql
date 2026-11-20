-- INOVAAGRO: tabelas do app (cada registro guarda seus campos em "dados")
create table if not exists membros (email text primary key, papel text not null default 'usuario', criado_em timestamptz default now());

create or replace function sou_membro() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
grant execute on function sou_membro() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['produtores','fazendas','talhoes','safras','monitoramentos','ordens'] loop
    execute format('create table if not exists %I (id text primary key, dados jsonb not null, atualizado_em timestamptz not null default now(), atualizado_por uuid default auth.uid())', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists membros_tudo on %I', t);
    execute format('create policy membros_tudo on %I for all to authenticated using (sou_membro()) with check (sou_membro())', t);
  end loop;
end $$;

alter table membros enable row level security;
-- membros: ninguém lê/escreve pelo app; o administrador gerencia pelo painel do Supabase.
