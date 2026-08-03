-- Stocke le prénom/nom du contact fournisseur sur l'entrée carnet (comme "nom" l'est déjà pour
-- l'entreprise/contact), pour affichage dans le carnet et les listes d'invitation en consultation.
alter table fournisseurs add column if not exists contact_prenom text;
alter table fournisseurs add column if not exists contact_nom text;
