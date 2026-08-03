-- Suppression d'un fournisseur du carnet = archivage, pas suppression réelle.
-- La ligne doit rester en base : consultation_fournisseurs, reponses_fournisseurs, daf et commandes
-- y font référence par clé étrangère, et les chantiers doivent garder leur historique complet
-- (consultations passées, commandes envoyées) même après retrait du fournisseur du carnet.
alter table fournisseurs add column if not exists archive boolean not null default false;
