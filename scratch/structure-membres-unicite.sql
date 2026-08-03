-- Un utilisateur n'appartient qu'à une seule structure : profiles.structure_id est une valeur unique,
-- et l'inviteur écrase ce champ quand il rattache un compte existant à son équipe. Sans contrainte,
-- une entreprise pouvait capter le compte d'une autre (y compris son référent) en connaissant son
-- email, le détachant de sa propre structure à son insu.
-- La contrainte tient au niveau base, donc indépendamment de ce que le RLS laisse voir au client.

-- 1) Repérer d'éventuels doublons AVANT d'ajouter la contrainte (doit renvoyer 0 ligne).
select user_id, count(*) as nb, array_agg(structure_id) as structures
from structure_membres
group by user_id
having count(*) > 1;

-- 2) Si la requête ci-dessus ne renvoie rien, appliquer la contrainte :
alter table structure_membres
  add constraint structure_membres_user_unique unique (user_id);
