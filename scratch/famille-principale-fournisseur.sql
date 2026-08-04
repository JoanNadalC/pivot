-- Famille principale du fournisseur : sa spécialité déclarée une fois, plutôt que devinée par
-- chaque entreprise qui l'ajoute à son carnet. Elle préremplit le classement à l'ajout depuis la
-- recherche portail — jusqu'ici la fiche arrivait sans famille, alors que le fournisseur, lui,
-- sait très bien ce qu'il vend.
alter table compte_fournisseur
  add column if not exists famille_principale_id uuid references familles_fournitures(id) on delete set null;

-- La recherche portail expose désormais cette famille. Elle n'est pas soumise au réglage de
-- visibilité : c'est une catégorie professionnelle publique, de même nature que la présence dans
-- l'annuaire — la masquer priverait la fonction de son objet sans rien protéger.
drop function if exists public.search_fournisseurs(text);
create or replace function public.search_fournisseurs(q text)
returns table(id uuid, societe text, fonction text, prenom text, nom text, telephone text, email text, ville text, pays text, siret text, famille_principale_id uuid)
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
    case when c.champs ? 'siret' then c.siret end,
    c.famille_principale_id
  from (select *, coalesce(visibilite_champs, '["entreprise","nom_initiale"]'::jsonb) as champs from compte_fournisseur) c
  where length(q) >= 2 and (
       coalesce(c.nom_entreprise,'') ilike '%'||q||'%' or coalesce(c.nom,'') ilike '%'||q||'%'
    or coalesce(c.email,'') ilike '%'||q||'%')
  order by 2 limit 10;
$$;

-- Le référentiel des familles doit être lisible par tout compte connecté : sans cela, le portail
-- fournisseur ne pourrait pas proposer la liste, et l'entreprise afficherait un identifiant nu.
alter table familles_fournitures enable row level security;
drop policy if exists "familles lisibles par tous" on familles_fournitures;
create policy "familles lisibles par tous" on familles_fournitures
  for select to authenticated using (true);
