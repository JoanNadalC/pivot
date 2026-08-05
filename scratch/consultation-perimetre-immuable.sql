-- Le périmètre d'une consultation envoyée est immuable.
--
-- La liste des fournitures est arrêtée au moment de l'envoi : c'est ce sur quoi le fournisseur a
-- été interrogé, ce sur quoi il a chiffré, et ce que son devis engage. L'élargir après coup
-- reviendrait à lui réclamer des prix qu'il n'a jamais donnés ; la réduire, à effacer une partie
-- de sa réponse. Une nouvelle demande relève d'une nouvelle consultation.
--
-- Un brouillon reste librement modifiable : rien n'est parti.
create or replace function public.consultation_perimetre_immuable()
returns trigger
language plpgsql
as $$
begin
  if old.statut <> 'brouillon' and old.fournitures_ids is not null
     and new.fournitures_ids is distinct from old.fournitures_ids then
    raise exception 'Le périmètre d''une consultation envoyée ne peut plus changer : créez une nouvelle consultation pour les fournitures ajoutées.'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_consultation_perimetre_immuable on consultations;
create trigger trg_consultation_perimetre_immuable
  before update on consultations
  for each row execute function public.consultation_perimetre_immuable();

-- Une consultation ne peut pas partir sans périmètre : sans lui, l'affichage retombe sur le filtre
-- de familles, recalculé à chaque fois — exactement le comportement qu'on vient de supprimer.
alter table consultations
  drop constraint if exists consultation_envoyee_a_un_perimetre;
alter table consultations
  add constraint consultation_envoyee_a_un_perimetre
  check (
    statut = 'brouillon'
    or date_envoi is null
    or fournitures_ids is not null
  ) not valid;
