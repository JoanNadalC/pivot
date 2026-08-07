-- ═══════════════════════════════════════════════════════════════════════════
-- Groupe multi-agences : la charnière, et rien d'autre
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une entreprise à plusieurs agences doit pouvoir exister dans Pivot : un compte de tête, des
-- agences ayant chacune son référent, ses licences et ses chantiers. Rien de tout cela n'est à
-- écrire aujourd'hui — mais la relation entre structures, elle, doit exister dès maintenant.
--
-- Pourquoi maintenant : ajouter une colonne nulle à une table ne change rien au comportement, alors
-- que reconstituer une hiérarchie sur des structures déjà peuplées oblige à rejouer chaque
-- politique RLS qui raisonne sur `structure_id`, c'est-à-dire presque toutes. Le coût est de
-- quelques minutes aujourd'hui contre plusieurs jours plus tard, à données réelles.
--
-- Ce que cette migration ne fait PAS : aucune notion de groupe dans les portails, aucun partage de
-- licences, aucun droit de lecture transversal. Une structure sans parent se comporte exactement
-- comme avant — ce qui est le cas de toutes celles qui existent.

alter table structures
  add column if not exists parent_id uuid references structures(id) on delete restrict;

comment on column structures.parent_id is
  'Structure de tête d''un groupe multi-agences. Nul pour une structure indépendante. '
  'on delete restrict : une tête ne disparaît pas en emportant ses agences.';

create index if not exists structures_parent_id_idx on structures(parent_id);

-- Une structure ne peut pas être sa propre tête. La profondeur reste volontairement libre : rien
-- n'impose aujourd'hui de trancher entre deux niveaux et davantage, et l'imposer serait un choix
-- gratuit qu'il faudrait défaire.
alter table structures
  drop constraint if exists structures_parent_pas_soi_meme;
alter table structures
  add constraint structures_parent_pas_soi_meme check (parent_id is null or parent_id <> id);

-- Contrôle : doit renvoyer 0.
select count(*) as structures_avec_parent from structures where parent_id is not null;
