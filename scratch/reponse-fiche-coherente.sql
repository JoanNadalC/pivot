-- Cohérence d'une réponse fournisseur avec sa consultation.
--
-- Deux incohérences ont réellement eu lieu, toutes deux silencieuses :
--   - `fournisseur_id` désignait la fiche de carnet d'une AUTRE entreprise : les prix se déposaient
--     chez un tiers, qui pouvait les lire, tandis que le destinataire ne voyait aucune réponse ;
--   - `entrepreneur_id` restait nul, faute d'invitation d'où le tirer : la réponse n'appartenait à
--     personne et le RLS la rendait invisible à l'entreprise même qui l'attendait.
--
-- Le code est corrigé, mais un défaut de confidentialité ne doit pas dépendre d'un ordre de
-- priorité dans une expression JavaScript. La règle vit ici, où elle vaut quel que soit le chemin
-- d'écriture — portail réécrit, import, appel direct à l'API.
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
  if new.consultation_id is null then
    return new;
  end if;

  select entrepreneur_id into v_ent_consultation from consultations where id = new.consultation_id;

  -- Consultation créée par le fournisseur lui-même, sans donneur d'ordre : rien à comparer.
  if v_ent_consultation is null then
    return new;
  end if;

  -- 1. La réponse appartient à l'entreprise qui a lancé la consultation.
  if new.entrepreneur_id is null then
    raise exception 'Réponse sans destinataire : elle ne serait visible par personne.'
      using errcode = '23514';
  end if;
  if new.entrepreneur_id <> v_ent_consultation then
    raise exception 'Réponse attribuée à une autre entreprise que celle de la consultation.'
      using errcode = '23514';
  end if;

  -- 2. La fiche de carnet utilisée appartient à cette même entreprise.
  if new.fournisseur_id is not null then
    select entrepreneur_id into v_ent_fiche from fournisseurs where id = new.fournisseur_id;
    if v_ent_fiche is not null and v_ent_fiche <> v_ent_consultation then
      raise exception 'Réponse rattachée à une fiche fournisseur d''une autre entreprise que celle de la consultation.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_reponse_fiche_coherente on reponses_fournisseurs;
create trigger trg_reponse_fiche_coherente
  before insert or update on reponses_fournisseurs
  for each row execute function public.reponse_fiche_coherente();
