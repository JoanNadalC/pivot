-- Reconstitution du périmètre des consultations déjà envoyées.
--
-- Les consultations antérieures au gel n'ont pas de liste figée : elles continuent donc de
-- s'élargir à chaque fourniture ajoutée au chantier. On reconstitue leur périmètre à partir de ce
-- qui existait au moment de l'envoi, filtré par les familles qu'elles précisaient.
--
-- Ce n'est pas la vérité, c'est la meilleure approximation disponible : `created_at` de la
-- fourniture contre `date_envoi` de la consultation. Une fourniture créée avant l'envoi mais
-- ajoutée au chantier plus tard serait mal classée — cas rare, et de toute façon préférable à une
-- liste qui s'allonge indéfiniment.
--
-- N'affecte que les consultations envoyées et encore sans périmètre.
update consultations c
set fournitures_ids = sous.ids
from (
  select c2.id,
         array_agg(f.id) as ids
  from consultations c2
  join fournitures f on f.chantier_id = c2.chantier_id
  where c2.statut <> 'brouillon'
    and c2.fournitures_ids is null
    and c2.date_envoi is not null
    and f.created_at <= c2.date_envoi
    and coalesce(f.is_variante, false) = false
    and (
      c2.familles is null
      or cardinality(c2.familles) = 0
      or f.famille_id is null
      or f.famille_id = any (c2.familles)
    )
  group by c2.id
) sous
where sous.id = c.id;

-- Contrôle : plus aucune consultation envoyée sans périmètre.
select count(*) as envoyees_sans_perimetre
from consultations
where statut <> 'brouillon' and date_envoi is not null and fournitures_ids is null;
