-- Deux niveaux de visibilité : ce que voit un inconnu qui vous cherche, et ce que voient en plus
-- vos partenaires acceptés.
--
-- Le réglage unique forçait un compromis intenable : publier son nom et son téléphone à l'annuaire
-- entier, ou les cacher à ceux avec qui on travaille. La mise en relation ayant justement pour
-- objet d'établir une confiance mutuelle, il est naturel qu'elle donne accès à davantage.
alter table compte_fournisseur  add column if not exists visibilite_relations jsonb;
alter table compte_moe          add column if not exists visibilite_relations jsonb;
alter table compte_entrepreneur add column if not exists visibilite_relations jsonb;

-- Contacts fournisseurs du carnet, résolus depuis le compte lié.
--
-- Le niveau appliqué dépend de l'état de la relation : une demande encore en attente ne donne
-- accès qu'au niveau public, sinon accepter n'aurait plus de sens — l'information serait déjà
-- obtenue. Les deux ensembles sont réunis, le second n'étant qu'un supplément : un champ public
-- ne peut pas être caché à un partenaire.
drop function if exists public.contacts_fournisseurs_lies();
create or replace function public.contacts_fournisseurs_lies()
returns table (compte_id uuid, societe text, prenom text, nom text, fonction text, email text, telephone text)
language sql
security definer
set search_path = public
stable
as $$
  with lien as (
    select coalesce(f.compte_fournisseur_id, f.fournisseur_portail_id) as compte_id,
           bool_or(f.statut = 'accepted') as accepte
    from fournisseurs f
    where f.entrepreneur_id = auth.uid()
      and coalesce(f.compte_fournisseur_id, f.fournisseur_portail_id) is not null
    group by 1
  ),
  vu as (
    select c.*, l.accepte,
      coalesce(c.visibilite_champs, '["entreprise","prenom_initiale","nom_initiale"]'::jsonb)
      || case when l.accepte
              then coalesce(c.visibilite_relations, '[]'::jsonb)
              else '[]'::jsonb end as champs
    from compte_fournisseur c
    join lien l on l.compte_id = c.id
  )
  select
    v.id,
    case when v.champs ? 'entreprise' then coalesce(nullif(v.nom_entreprise,''), v.nom) end,
    case when v.champs ? 'prenom' then v.prenom
         when v.champs ? 'prenom_initiale' and coalesce(v.prenom,'') <> '' then upper(left(v.prenom,1))||'.' end,
    case when v.champs ? 'nom' then v.nom
         when v.champs ? 'nom_initiale' and coalesce(v.nom,'') <> '' then upper(left(v.nom,1))||'.' end,
    case when v.champs ? 'fonction' then v.fonction end,
    case when v.champs ? 'email' then v.email end,
    case
      when v.champs ? 'tel_standard' and v.champs ? 'portable' then nullif(concat_ws(' / ', nullif(v.tel_fixe_direct,''), nullif(v.tel_portable,'')), '')
      when v.champs ? 'tel_standard' then v.tel_fixe_direct
      when v.champs ? 'portable' then v.tel_portable
    end
  from vu v;
$$;

revoke all on function public.contacts_fournisseurs_lies() from public;
grant execute on function public.contacts_fournisseurs_lies() to authenticated;
