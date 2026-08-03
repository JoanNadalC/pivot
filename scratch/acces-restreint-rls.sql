-- Applique la lecture seule côté base pour les structures en accès restreint.
--
-- Jusqu'ici la restriction n'existait que dans le navigateur, sur six points de création, alors
-- que les portails comptent environ 130 écritures. Toute écriture non couverte passait, et un
-- utilisateur averti pouvait contourner l'ensemble.
--
-- Principe : une politique RESTRICTIVE se combine par ET avec toutes les autres. Elle ne peut donc
-- pas être contournée par une politique permissive existante, contrairement à un simple ajout.
-- La lecture reste entière — c'est tout l'objet de l'accès restreint : consulter et exporter.

-- ── Le prédicat ───────────────────────────────────────────────────────────────
-- SECURITY DEFINER car l'appelant n'a pas forcément le droit de lire `structures`.
-- STABLE pour que PostgreSQL n'évalue pas la fonction ligne à ligne.
create or replace function public.structure_restreinte(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(bool_or(s.acces_restreint), false)
  from structure_membres m
  join structures s on s.id = m.structure_id
  where m.user_id = uid;
$$;

revoke all on function public.structure_restreinte(uuid) from public;
grant execute on function public.structure_restreinte(uuid) to authenticated;

-- ── Application aux tables métier ─────────────────────────────────────────────
-- Boucle plutôt qu'une centaine de lignes répétées : moins d'occasions de se tromper, et les
-- tables absentes sont ignorées silencieusement plutôt que d'interrompre le script.
do $$
declare
  t text;
  tables text[] := array[
    'chantiers', 'fournitures', 'consultations', 'reponses_fournisseurs',
    'daf', 'documents_viser', 'commandes', 'commande_lignes',
    'fournisseurs', 'comparatif_selections', 'comparatif_masques',
    'chantier_config', 'doe_config', 'lots', 'lot_entreprises',
    'catalogue_fiches', 'catalogue_familles', 'catalogue_sous_familles',
    'demandes_photos', 'photos_fournitures', 'demandes_modification'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'table absente, ignorée : %', t;
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', 'acces restreint - insert', t);
    execute format('drop policy if exists %I on public.%I', 'acces restreint - update', t);
    execute format('drop policy if exists %I on public.%I', 'acces restreint - delete', t);

    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
       with check (not public.structure_restreinte())', 'acces restreint - insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated
       using (not public.structure_restreinte())', 'acces restreint - update', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated
       using (not public.structure_restreinte())', 'acces restreint - delete', t);
  end loop;
end $$;

-- ── Vérification ──────────────────────────────────────────────────────────────
-- Doit renvoyer false pour un compte actif, true pour un compte restreint :
--   select public.structure_restreinte('<user_id>');
--
-- Et pour lister ce qui a été posé :
--   select tablename, policyname from pg_policies
--    where policyname like 'acces restreint%' order by tablename;
