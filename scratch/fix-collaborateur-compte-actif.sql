-- Le badge "Actif"/"En attente" se basait sur la présence de auth_user_id, mais ce champ est
-- rempli dès l'envoi de l'invitation (création du compte auth côté serveur), pas seulement une
-- fois que la personne a effectivement défini son mot de passe. On ajoute un vrai indicateur.
alter table collaborateurs add column if not exists compte_actif boolean not null default false;
