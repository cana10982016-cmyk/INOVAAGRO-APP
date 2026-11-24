-- INOVAAGRO: armazenamento de fotos, vídeos, áudios e anexos feitos no campo pelo celular.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- Os arquivos ficam com nomes aleatórios; só membros da equipe conseguem enviar ou apagar.
insert into storage.buckets (id, name, public, file_size_limit)
values ('campo', 'campo', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists campo_enviar on storage.objects;
create policy campo_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'campo' and public.sou_membro());

drop policy if exists campo_apagar on storage.objects;
create policy campo_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'campo' and public.sou_membro());

-- O envio precisa também poder "ver" e "substituir" o arquivo recém-enviado (sem isso o Storage
-- responde erro 400 e as fotos ficam presas no celular). Corrigido em 2026-11-24.
drop policy if exists campo_ver on storage.objects;
create policy campo_ver on storage.objects for select to authenticated
  using (bucket_id = 'campo' and public.sou_membro());

drop policy if exists campo_alterar on storage.objects;
create policy campo_alterar on storage.objects for update to authenticated
  using (bucket_id = 'campo' and public.sou_membro())
  with check (bucket_id = 'campo' and public.sou_membro());
