-- ═══════════════════════════════════════════════════════════════════════════
-- Étape A — la lecture du Storage exige un compte
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Aucun bucket ne change de statut ici : les publics le restent. On resserre seulement les
-- politiques de lecture, qui n'exigeaient rien. Tant qu'un bucket est public, cela ne se voit pas ;
-- le jour où il devient privé, c'est cette condition qui décide qui peut encore signer une URL —
-- et sans elle, n'importe quel visiteur muni de la clé publique du site pourrait le faire.
--
-- `daf-pdfs` porte déjà la condition. Les autres non.

-- ── DOE ─────────────────────────────────────────────────────────────────────
drop policy if exists "doe-pdfs public read" on storage.objects;
create policy "doe-pdfs read authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'doe-pdfs' and auth.uid() is not null);

-- ── Fiches techniques ───────────────────────────────────────────────────────
drop policy if exists "read fiches techniques" on storage.objects;
create policy "read fiches techniques" on storage.objects
  for select to authenticated
  using (bucket_id = 'fiches-techniques' and auth.uid() is not null);

-- ── Photos de fournitures ───────────────────────────────────────────────────
drop policy if exists "collab_read_photos" on storage.objects;
create policy "collab_read_photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos-fournitures' and auth.uid() is not null);

-- ── Devis fournisseurs : bucket déjà privé, mais deux politiques de lecture s'y cumulaient
--    sans exiger de compte. Une seule suffit, et elle exige.
drop policy if exists "authenticated read devis-fournisseurs" on storage.objects;
drop policy if exists "fournisseur read devis" on storage.objects;
create policy "read devis-fournisseurs" on storage.objects
  for select to authenticated
  using (bucket_id = 'devis-fournisseurs' and auth.uid() is not null);

-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Chaque bucket doit avoir exactement une politique SELECT, exigeant un compte.
select
  regexp_replace(qual::text, '.*bucket_id = ''([^'']+)''.*', '\1') as bucket,
  policyname,
  qual ilike '%auth.uid() is not null%' as exige_un_compte
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
order by 1;
