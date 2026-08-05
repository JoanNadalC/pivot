-- Une DAF en brouillon ne regarde que son auteur : tant qu'elle n'est pas soumise, elle peut
-- contenir des prix provisoires ou des postes abandonnés. Le portail MOE la filtre déjà à
-- l'affichage, mais ce filtre est cosmétique — la ligne transite quand même par le réseau et
-- reste lisible à qui interroge l'API directement.
--
-- Politique RESTRICTIVE : elle se combine en ET avec toutes les politiques de lecture
-- existantes, sans avoir à les réécrire ni à savoir comment le MOE accède aux DAF soumises.
-- Elle ne fait que retrancher les brouillons pour tout le monde sauf leur auteur.
drop policy if exists "daf brouillon invisible hors auteur" on daf;
create policy "daf brouillon invisible hors auteur" on daf
  as restrictive for select to authenticated
  using (statut is distinct from 'brouillon' or entrepreneur_id = auth.uid());
