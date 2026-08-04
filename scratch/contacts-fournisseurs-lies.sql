-- Nom du contact d'un fournisseur du portail, résolu à la lecture plutôt que recopié à l'ajout.
--
-- Le carnet figeait le nom au moment de l'ajout. Un fournisseur qui complète ensuite son profil,
-- dévoile son nom ou change de commercial laissait derrière lui des fiches périmées, sans qu'aucun
-- geste ne puisse les rafraîchir. Le compte lié est la source ; la copie ne garde son sens que
-- pour les fiches saisies à la main, qui ne pointent vers aucun compte.
--
-- La fonction applique les mêmes réglages de visibilité que la recherche : être au carnet de
-- quelqu'un ne donne pas plus de droits qu'y apparaître. Elle ne renvoie que les comptes déjà
-- présents dans le carnet de l'appelant — elle ne peut pas servir à parcourir l'annuaire.
drop function if exists public.contacts_fournisseurs_lies();
create or replace function public.contacts_fournisseurs_lies()
returns table (compte_id uuid, societe text, prenom text, nom text)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    case when c.champs ? 'entreprise' then coalesce(nullif(c.nom_entreprise,''), c.nom) end,
    case when c.champs ? 'prenom' then c.prenom
         when c.champs ? 'prenom_initiale' and coalesce(c.prenom,'') <> '' then upper(left(c.prenom,1))||'.' end,
    case when c.champs ? 'nom' then c.nom
         when c.champs ? 'nom_initiale' and coalesce(c.nom,'') <> '' then upper(left(c.nom,1))||'.' end
  from (
    select *, coalesce(visibilite_champs, '["entreprise","prenom_initiale","nom_initiale"]'::jsonb) as champs
    from compte_fournisseur
  ) c
  where c.id in (
    select f.compte_fournisseur_id from fournisseurs f
     where f.entrepreneur_id = auth.uid() and f.compte_fournisseur_id is not null
    union
    select f.fournisseur_portail_id from fournisseurs f
     where f.entrepreneur_id = auth.uid() and f.fournisseur_portail_id is not null
  );
$$;

revoke all on function public.contacts_fournisseurs_lies() from public;
grant execute on function public.contacts_fournisseurs_lies() to authenticated;
