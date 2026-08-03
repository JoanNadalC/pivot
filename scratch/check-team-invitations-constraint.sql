select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'team_invitations'::regclass and conname = 'team_invitations_statut_check';
