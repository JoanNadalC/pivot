-- Téléphone professionnel individuel (fixe + portable), distinct du téléphone standard entreprise
alter table compte_fournisseur add column if not exists tel_fixe_direct text;
alter table compte_fournisseur add column if not exists tel_portable text;

-- Visibilité dans les recherches : passe d'un enum figé (societe_fonction, societe_initiale...)
-- à une liste de champs choisis librement (entreprise, ville, pays, nom, prenom, nom_initiale,
-- prenom_initiale, siret, tel_standard, portable, email)
alter table compte_fournisseur add column if not exists visibilite_champs jsonb;
