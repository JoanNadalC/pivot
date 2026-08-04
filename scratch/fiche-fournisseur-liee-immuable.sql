-- Une fiche de carnet adossée à un compte inscrit décrit une entité qui tient elle-même ses
-- informations. L'entreprise en dispose, elle n'en est pas l'auteur.
--
-- Le RLS ne peut pas exprimer cette règle : il répond « ce compte peut-il écrire sur cette ligne »,
-- et la réponse est oui — c'est bien sa fiche, dans son carnet, avec son classement et ses notes.
-- Ce qui est illégitime tient à la provenance de l'information, pas à la propriété de la ligne.
-- D'où un déclencheur, seul à voir l'ancienne et la nouvelle version et donc à pouvoir raisonner
-- sur le changement lui-même.
--
-- Le portail affiche déjà ces champs en lecture seule, mais une règle qui ne vit que dans un
-- fichier servi au navigateur finit par céder : import, correction manuelle, appel direct à l'API.
create or replace function public.fiche_fournisseur_liee_immuable()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.compte_fournisseur_id, new.fournisseur_portail_id) is not null
     and (new.nom     is distinct from old.nom
       or new.siret   is distinct from old.siret
       or new.email   is distinct from old.email
       or new.tel     is distinct from old.tel
       or new.adresse is distinct from old.adresse
       or new.pays    is distinct from old.pays) then
    raise exception 'Ce fournisseur est inscrit sur Pivot et tient lui-même ses informations : seul son classement peut être modifié.'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- Sur UPDATE seulement : à l'ajout depuis la recherche, ces colonnes sont légitimement
-- renseignées d'après le compte. Le rattachement d'une fiche manuelle à un compte trouvé par
-- email passe aussi, puisqu'il ne touche qu'aux identifiants de liaison.
drop trigger if exists trg_fiche_fournisseur_liee_immuable on fournisseurs;
create trigger trg_fiche_fournisseur_liee_immuable
  before update on fournisseurs
  for each row execute function public.fiche_fournisseur_liee_immuable();
