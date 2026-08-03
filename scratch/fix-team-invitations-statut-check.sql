alter table team_invitations drop constraint team_invitations_statut_check;
alter table team_invitations add constraint team_invitations_statut_check
  check (statut = any (array['pending'::text, 'accepted'::text, 'cancelled'::text]));
