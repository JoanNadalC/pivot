-- Remplace le menu déroulant "niveau de visibilité" par un choix de champs à cocher, sur les 3 portails
-- (le fournisseur avait déjà visibilite_champs mais la fonction de recherche ne le consommait pas encore).
alter table compte_entrepreneur add column if not exists visibilite_champs jsonb;
alter table compte_moe add column if not exists visibilite_champs jsonb;
alter table compte_moe add column if not exists ville text;
alter table compte_moe add column if not exists prenom text;
alter table compte_fournisseur add column if not exists prenom text;

-- search_entreprises (consultée par le portail MOE) : ajoute ville/pays/siret/prénom-initiale,
-- pilotée par visibilite_champs au lieu de l'ancien niveau fixe "visibilite".
drop function if exists public.search_entreprises(text);
create or replace function public.search_entreprises(q text)
returns table(id uuid, societe text, fonction text, prenom text, nom text, telephone text, email text, ville text, pays text, siret text)
language sql security definer set search_path to 'public' as $$
  select c.id,
    case when c.champs ? 'entreprise' then coalesce(nullif(c.raison_sociale,''), nullif(c.societe,'')) end,
    case when c.champs ? 'fonction' then c.fonction end,
    case when c.champs ? 'prenom' then c.prenom
         when c.champs ? 'prenom_initiale' and coalesce(c.prenom,'')<>'' then upper(left(c.prenom,1))||'.' end,
    case when c.champs ? 'nom' then c.nom
         when c.champs ? 'nom_initiale' and coalesce(c.nom,'')<>'' then upper(left(c.nom,1))||'.' end,
    case when c.champs ? 'telephone' then c.telephone end,
    case when c.champs ? 'email' then c.email end,
    case when c.champs ? 'ville' then c.ville end,
    case when c.champs ? 'pays' then c.pays end,
    case when c.champs ? 'siret' then c.siret end
  from (select *, coalesce(visibilite_champs, '["entreprise","nom_initiale"]'::jsonb) as champs from compte_entrepreneur) c
  where length(q) >= 2 and (
       coalesce(c.raison_sociale,'') ilike '%'||q||'%' or coalesce(c.societe,'') ilike '%'||q||'%'
    or coalesce(c.nom,'') ilike '%'||q||'%' or coalesce(c.prenom,'') ilike '%'||q||'%'
    or coalesce(c.email,'') ilike '%'||q||'%')
  order by 2 limit 8;
$$;

-- search_fournisseurs (consultée par le portail entreprise) : ajoute ville/pays/siret/prénom, sépare
-- téléphone standard/portable (tel_fixe_direct/tel_portable, alignés sur le vrai formulaire de profil
-- au lieu de l'ancienne colonne "telephone" qui n'était plus mise à jour).
drop function if exists public.search_fournisseurs(text);
create or replace function public.search_fournisseurs(q text)
returns table(id uuid, societe text, fonction text, prenom text, nom text, telephone text, email text, ville text, pays text, siret text)
language sql security definer set search_path to 'public' as $$
  select c.id,
    case when c.champs ? 'entreprise' then coalesce(nullif(c.nom_entreprise,''), c.nom) end,
    case when c.champs ? 'fonction' then c.fonction end,
    case when c.champs ? 'prenom' then c.prenom
         when c.champs ? 'prenom_initiale' and coalesce(c.prenom,'')<>'' then upper(left(c.prenom,1))||'.' end,
    case when c.champs ? 'nom' then c.nom
         when c.champs ? 'nom_initiale' and coalesce(c.nom,'')<>'' then upper(left(c.nom,1))||'.' end,
    case
      when c.champs ? 'tel_standard' and c.champs ? 'portable' then nullif(concat_ws(' / ', nullif(c.tel_fixe_direct,''), nullif(c.tel_portable,'')), '')
      when c.champs ? 'tel_standard' then c.tel_fixe_direct
      when c.champs ? 'portable' then c.tel_portable
    end,
    case when c.champs ? 'email' then c.email end,
    case when c.champs ? 'ville' then c.ville end,
    case when c.champs ? 'pays' then c.pays end,
    case when c.champs ? 'siret' then c.siret end
  from (select *, coalesce(visibilite_champs, '["entreprise","nom_initiale"]'::jsonb) as champs from compte_fournisseur) c
  where length(q) >= 2 and (
       coalesce(c.nom_entreprise,'') ilike '%'||q||'%' or coalesce(c.nom,'') ilike '%'||q||'%'
    or coalesce(c.email,'') ilike '%'||q||'%')
  order by 2 limit 10;
$$;

-- search_moe (consultée par le portail entreprise) : pas de pays en base côté MOE ; ajoute
-- ville/prénom/siret. La colonne "tel" est désormais mise à jour depuis Mon compte (avant, seul
-- profiles.telephone l'était, jamais compte_moe.tel que cette fonction lit — le téléphone affiché
-- en recherche restait figé).
drop function if exists public.search_moe(text);
create or replace function public.search_moe(q text)
returns table(id uuid, societe text, fonction text, prenom text, nom text, telephone text, email text, ville text, siret text)
language sql security definer set search_path to 'public' as $$
  select c.id,
    case when c.champs ? 'entreprise' then nullif(c.societe,'') end,
    case when c.champs ? 'fonction' then c.fonction end,
    case when c.champs ? 'prenom' then c.prenom
         when c.champs ? 'prenom_initiale' and coalesce(c.prenom,'')<>'' then upper(left(c.prenom,1))||'.' end,
    case when c.champs ? 'nom' then c.nom
         when c.champs ? 'nom_initiale' and coalesce(c.nom,'')<>'' then upper(left(c.nom,1))||'.' end,
    case when c.champs ? 'telephone' then c.tel end,
    case when c.champs ? 'email' then c.email end,
    case when c.champs ? 'ville' then c.ville end,
    case when c.champs ? 'siret' then c.siret end
  from (select *, coalesce(visibilite_champs, '["entreprise","nom_initiale"]'::jsonb) as champs from compte_moe) c
  where length(q) >= 2 and (
       coalesce(c.societe,'') ilike '%'||q||'%' or coalesce(c.nom,'') ilike '%'||q||'%'
    or coalesce(c.email,'') ilike '%'||q||'%')
  order by 2 limit 8;
$$;
