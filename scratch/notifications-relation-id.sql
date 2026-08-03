-- Permet à une notification de mise en relation de pointer la demande concernée.
-- Sans elle, un clic sur la notification n'ouvrirait que la liste, à charge pour le fournisseur
-- de retrouver la bonne ligne — pénible dès qu'il en a plusieurs en attente.
alter table notifications add column if not exists relation_id uuid;
