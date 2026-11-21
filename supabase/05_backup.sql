-- INOVAAGRO: backup semanal automático (rodar uma vez no editor SQL do Supabase; pode rodar de novo sem problema)
-- Toda segunda-feira às 6h (horário de Brasília) o banco tira uma cópia de TODAS as tabelas do app
-- (fazendas, talhões, safras, visitas, ordens, chuvas, financeiro, equipe...) e guarda na tabela "backups".
-- Ficam as 8 cópias mais recentes (2 meses). Só o administrador vê e baixa os backups pelo app
-- (menu Administração > Backup dos dados). As fotos ficam no armazenamento de arquivos e não entram aqui.

create extension if not exists pg_cron;

create table if not exists backups (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  origem text not null default 'automático',
  tabelas int,
  registros int,
  tamanho_kb int,
  dados jsonb not null
);
alter table backups enable row level security;
drop policy if exists backups_admin_ler on backups;
create policy backups_admin_ler on backups for select to authenticated using (sou_admin());
revoke all on backups from anon;
grant select on backups to authenticated;

create or replace function fazer_backup(p_origem text default 'automático') returns bigint
language plpgsql security definer set search_path = public as $$
declare
  t text; arr jsonb; n int; tot jsonb := '{}'::jsonb; ntab int := 0; nreg int := 0; novo bigint;
begin
  -- pelo app só o administrador pode pedir; o agendamento (sem usuário) também pode
  if auth.uid() is not null and not sou_admin() then
    raise exception 'Só o administrador pode fazer backup';
  end if;
  for t in
    select c.table_name from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'dados' and c.data_type = 'jsonb' and c.table_name <> 'backups'
     group by c.table_name order by c.table_name
  loop
    execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'', id, ''dados'', dados)), ''[]''::jsonb), count(*) from %I', t) into arr, n;
    tot := tot || jsonb_build_object(t, arr); ntab := ntab + 1; nreg := nreg + n;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into arr from membros m;
  tot := tot || jsonb_build_object('membros', arr);
  insert into backups (origem, tabelas, registros, tamanho_kb, dados)
    values (coalesce(p_origem, 'automático'), ntab, nreg, (octet_length(tot::text) / 1024)::int, tot)
    returning id into novo;
  delete from backups where id not in (select id from backups order by criado_em desc limit 8);
  return novo;
end $$;
revoke all on function fazer_backup(text) from public, anon;
grant execute on function fazer_backup(text) to authenticated;

-- agenda: segunda-feira 09:00 UTC = 06:00 em Brasília
select cron.unschedule(jobid) from cron.job where jobname = 'inovaagro-backup-semanal';
select cron.schedule('inovaagro-backup-semanal', '0 9 * * 1', $$select public.fazer_backup('automático')$$);

-- primeira cópia agora, para conferir que funcionou
select public.fazer_backup('primeira cópia');
