-- Une réponse doit être déposée sous une fiche de carnet appartenant à l'entreprise qui a lancé la
-- consultation. Rien ne l'imposait : le portail fournisseur a pu écrire des prix sous la fiche
-- d'un autre client, sans erreur ni trace — l'entreprise destinataire ne voyait aucune réponse,
-- et une entreprise tierce pouvait lire des prix qui ne lui étaient pas destinés.
--
-- Le code est corrigé, mais un défaut de confidentialité ne doit pas dépendre d'un ordre de
-- priorité dans une expression JavaScript. La règle vit désormais en base, où elle vaut quel que
-- soit le chemin d'écriture.
--
-- Déclencheur plutôt que contrainte CHECK : la vérification traverse deux tables, ce qu'une
-- contrainte de colonne ne sait pas exprimer.
create or replace function public.reponse_fiche_coherente()
returns trigger
language plpgsql
as $$
declare
  v_ent_consultation uuid;
  v_ent_fiche uuid;
begin
  if new.fournisseur_id is null or new.consultation_id is null then
    return new;
  end if;

  select entrepreneur_id into v_ent_consultation from consultations where id = new.consultation_id;
  select entrepreneur_id into v_ent_fiche       from fournisseurs  where id = new.fournisseur_id;

  -- Consultation créée par le fournisseur lui-même, sans donneur d'ordre : rien à comparer.
  if v_ent_consultation is null or v_ent_fiche is null then
    return new;
  end if;

  if v_ent_consultation <> v_ent_fiche then
    raise exception 'Réponse rattachée à une fiche fournisseur d''une autre entreprise que celle de la consultation.'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_reponse_fiche_coherente on reponses_fournisseurs;
create trigger trg_reponse_fiche_coherente
  before insert or update on reponses_fournisseurs
  for each row execute function public.reponse_fiche_coherente();
