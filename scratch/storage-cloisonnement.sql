-- Cloisonne les écritures et suppressions dans le Storage, et rend les visas inaltérables.
-- Script unique : remplace visa-immuable-storage.sql, qui faisait doublon sur la politique UPDATE.
--
-- Constat de l'audit : toutes les politiques filtrent sur le bucket, jamais sur le propriétaire.
-- Conséquence, n'importe quel compte connecté peut aujourd'hui écraser le devis d'un autre
-- fournisseur, la DAF d'un autre chantier, ou supprimer le DOE de n'importe quel client.
--
-- On s'appuie sur storage.objects.owner, renseigné automatiquement à l'envoi : pas de jointure,
-- donc pas de risque de verrouiller quelqu'un hors de ses propres fichiers.
-- La clé de service (worker) contourne le RLS : la purge à la suppression de compte reste possible.

-- ── DOE : la suppression était ouverte à tout compte connecté, sur n'importe quel chantier.
--    Un DOE est le livrable de fin de chantier : sa perte est irréversible.
drop policy if exists "doe-pdfs delete authenticated" on storage.objects;
create policy "doe-pdfs delete owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'doe-pdfs' and owner = auth.uid());

-- ── Devis fournisseurs : deux politiques permissives autorisaient l'écrasement par quiconque.
--    Elles se cumulaient par OU, donc en corriger une seule n'aurait rien changé.
drop policy if exists "authenticated update devis-fournisseurs" on storage.objects;
drop policy if exists "fournisseur update devis" on storage.objects;
create policy "devis update owner" on storage.objects
  for update to authenticated
  using (bucket_id = 'devis-fournisseurs' and owner = auth.uid());

-- ── DAF : l'entreprise doit pouvoir régénérer sa DAF tant qu'elle n'est pas visée, mais
--    seulement la sienne, et jamais un fichier de visa.
drop policy if exists "update daf pdf" on storage.objects;
create policy "update daf pdf" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'daf-pdfs'
    and owner = auth.uid()
    and name not like '%/visa-%'
  );

-- ── Visas inaltérables : filet de sécurité indépendant des politiques ci-dessus.
--    Une politique RESTRICTIVE se combine par ET avec toutes les autres : même si une politique
--    permissive était ajoutée plus tard sur ce bucket, les visas resteraient protégés.
--    Volontairement limitées à UPDATE et DELETE — en « for all » elles bloqueraient aussi la
--    lecture, rendant les visas ni consultables ni exportables.
drop policy if exists "visa immuable - modification" on storage.objects;
create policy "visa immuable - modification" on storage.objects
  as restrictive
  for update to authenticated
  using (not (bucket_id = 'daf-pdfs' and name like '%/visa-%'));

drop policy if exists "visa immuable - suppression" on storage.objects;
create policy "visa immuable - suppression" on storage.objects
  as restrictive
  for delete to authenticated
  using (not (bucket_id = 'daf-pdfs' and name like '%/visa-%'));

-- ── Bucket orphelin : doe-fichiers est public, sans aucune politique, et n'est référencé
--    nulle part dans le code. À supprimer après avoir vérifié qu'il est bien vide :
--      select count(*) from storage.objects where bucket_id = 'doe-fichiers';
