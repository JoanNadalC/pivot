-- Réciproque de `contacts_fournisseurs_lies` : ce qu'un fournisseur ou un maître d'œuvre voit des
-- entreprises avec lesquelles il travaille.
--
-- Le second niveau de visibilité était réglable dans les trois portails mais n'était lu que dans
-- un sens. Une entreprise pouvait décider d'ouvrir son nom et son téléphone à ses partenaires sans
-- que ceux-ci en voient jamais rien.
--
-- Deux sources de relation, réunies :
--   - le carnet fournisseur d'une entreprise, quand elle a accepté la mise en relation ;
--   - le rattachement d'un maître d'œuvre à un chantier, qui vaut collaboration établie.
-- Une demande encore en attente n'ouvre que le niveau public, ici comme dans l'autre sens.
create or replace function public.contacts_entreprises_liees()
returns table (compte_id uuid, societe text, prenom text, nom text, fonction text, email text, telephone text, ville text)
language sql
security definer
set search_path = public
stable
as $$
  with lien as (
    -- Fournisseur : présent au carnet d'une entreprise, relation acceptée.
    select f.entrepreneur_id as compte_id, f.statut = 'accepted' as accepte
    from fournisseurs f
    where coalesce(f.compte_fournisseur_id, f.fournisseur_portail_id) = auth.uid()
      and f.entrepreneur_id is not null
    union all
    -- Maître d'œuvre : rattaché au chantier d'une entreprise.
    select c.entrepreneur_id, true
    from chantiers c
    where c.moe_id = auth.uid() and c.entrepreneur_id is not null
    union all
    -- Maître d'œuvre : inscrit au carnet d'une entreprise.
    select m.entrepreneur_id, true
    from maitres_oeuvre m
    where m.compte_moe_id = auth.uid() and m.entrepreneur_id is not null
  ),
  fusion as (
    select compte_id, bool_or(accepte) as accepte
    from lien group by compte_id
  ),
  vu as (
    select c.*, l.accepte,
      coalesce(c.visibilite_champs, '["entreprise","prenom_initiale","nom_initiale"]'::jsonb)
      || case when l.accepte
              then coalesce(c.visibilite_relations, '["entreprise","ville","prenom","nom","fonction","telephone","email"]'::jsonb)
              else '[]'::jsonb end as champs
    from compte_entrepreneur c
    join fusion l on l.compte_id = c.id
  )
  select
    v.id,
    case when v.champs ? 'entreprise' then coalesce(nullif(v.raison_sociale,''), nullif(v.societe,''), v.nom) end,
    case when v.champs ? 'prenom' then v.prenom
         when v.champs ? 'prenom_initiale' and coalesce(v.prenom,'') <> '' then upper(left(v.prenom,1))||'.' end,
    case when v.champs ? 'nom' then v.nom
         when v.champs ? 'nom_initiale' and coalesce(v.nom,'') <> '' then upper(left(v.nom,1))||'.' end,
    case when v.champs ? 'fonction' then v.fonction end,
    case when v.champs ? 'email' then v.email end,
    case when v.champs ? 'telephone' then v.telephone end,
    case when v.champs ? 'ville' then v.ville end
  from vu v;
$$;

revoke all on function public.contacts_entreprises_liees() from public;
grant execute on function public.contacts_entreprises_liees() to authenticated;
