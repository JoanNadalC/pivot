-- Unicité d'une réponse fournisseur : par consultation, et non globalement.
--
-- La contrainte portait sur (fourniture_id, fournisseur_id, variante_ordre), sans la consultation.
-- Un fournisseur ne pouvait donc donner qu'un seul prix par fourniture, tous appels d'offres
-- confondus : un second tour, une révision de prix ou une consultation scindée en lots se heurtait
-- à un doublon. Et vu que ces écritures ne vérifiaient rien, l'échec passait inaperçu.
--
-- Un prix se rapporte à une demande précise, à une date et dans un contexte donnés. Le rattacher à
-- la consultation n'est pas un assouplissement : c'est la clé qui avait été omise.
--
-- Aucune conversion de données n'est nécessaire : l'ancienne contrainte était plus stricte, ce qui
-- existe satisfait donc la nouvelle.
alter table reponses_fournisseurs
  drop constraint if exists reponses_fournisseurs_fourniture_id_fournisseur_id_variante_key;

alter table reponses_fournisseurs
  add constraint reponses_fournisseurs_unicite_par_consultation
  unique (consultation_id, fourniture_id, fournisseur_id, variante_ordre);
