-- Chaque document exigé par le MOE a maintenant un nom précis dans sa catégorie
-- (ex. catégorie "Plan", nom "Plan de masse"), pas juste une catégorie cochée.
alter table chantier_documents_requis add column if not exists nom text;
-- L'ancienne contrainte unique(chantier_id, categorie) empêchait plusieurs noms par catégorie : on la retire.
alter table chantier_documents_requis drop constraint if exists chantier_documents_requis_chantier_id_categorie_key;
