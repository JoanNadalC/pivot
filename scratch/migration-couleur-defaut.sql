-- Couleur par défaut des documents PDF (DAF/DOE/Suivi), appliquée aux nouveaux chantiers
alter table profiles add column if not exists default_bandeau_bg text;
alter table profiles add column if not exists default_bandeau_text text;
