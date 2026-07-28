-- Permet de relier une structure à son abonnement Stripe (nécessaire pour détecter les résiliations)
alter table structures add column if not exists stripe_customer_id text;
alter table structures add column if not exists stripe_subscription_id text;

-- Vérifie si statut_abonnement a une contrainte CHECK qui limiterait les valeurs possibles
-- (le nouveau code écrit 'resilie' — si la contrainte existe et ne l'autorise pas, il faudra l'élargir,
-- comme on a dû le faire pour team_invitations.statut). Lance cette requête et renvoie le résultat :
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'structures'::regclass and contype = 'c';
