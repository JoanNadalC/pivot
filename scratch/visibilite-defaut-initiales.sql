-- Par défaut, un compte publie sa raison sociale et les initiales de son prénom ET de son nom.
--
-- Le défaut n'incluait que l'initiale du nom. Deux collègues d'un même établissement dont le
-- prénom commence différemment restaient indistinguables — et c'est le cas de figure ordinaire,
-- puisque presque personne ne touche à ce réglage.
--
-- Une initiale ne désigne personne à elle seule ; elle suffit en revanche à distinguer deux
-- interlocuteurs au sein d'une même société, ce qui est précisément l'usage de cette recherche.

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
  from (select *, coalesce(visibilite_champs, '["entreprise","prenom_initiale","nom_initiale"]'::jsonb) as champs from compte_fournisseur) c
  where length(q) >= 2 and (
       coalesce(c.nom_entreprise,'') ilike '%'||q||'%' or coalesce(c.nom,'') ilike '%'||q||'%'
    or coalesce(c.email,'') ilike '%'||q||'%')
  order by 2 limit 10;
$$;

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
  from (select *, coalesce(visibilite_champs, '["entreprise","prenom_initiale","nom_initiale"]'::jsonb) as champs from compte_moe) c
  where length(q) >= 2 and (
       coalesce(c.societe,'') ilike '%'||q||'%' or coalesce(c.nom,'') ilike '%'||q||'%'
    or coalesce(c.email,'') ilike '%'||q||'%')
  order by 2 limit 10;
$$;
