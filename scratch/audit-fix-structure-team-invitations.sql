-- structure_invitations : "lecture publique par token" a using:true → n'importe qui peut lister
-- TOUTES les invitations (tokens, emails, structures) sans même être connecté.
-- Remplacé par une RPC scopée à un seul token, comme pour chantier_invitations.
drop policy if exists "lecture publique par token" on structure_invitations;

create or replace function get_structure_invitation_public(p_token text)
returns table (id uuid, structure_id uuid, role text, has_licence boolean, email text, expires_at timestamptz, accepted_at timestamptz, structure_nom text, structure_type text)
language sql
security definer
set search_path = public
as $$
  select si.id, si.structure_id, si.role, si.has_licence, si.email, si.expires_at, si.accepted_at, s.nom, s.type
  from structure_invitations si
  join structures s on s.id = si.structure_id
  where si.token = p_token
  limit 1;
$$;
revoke all on function get_structure_invitation_public(text) from public;
grant execute on function get_structure_invitation_public(text) to anon, authenticated;

-- Il manquait une policy permettant à l'invité d'accepter (mettre accepted_at) sa propre invitation :
-- seuls admin_compte/admin pivot avaient un accès en écriture, donc cet UPDATE échouait silencieusement
-- pour un nouvel utilisateur qui n'est pas encore admin_compte de la structure.
create policy structure_invitations_accept_own on structure_invitations for update to authenticated using (
  email = (auth.jwt() ->> 'email')
) with check (
  email = (auth.jwt() ->> 'email')
);

-- team_invitations : team_inv_anon_read (anon, using:true) n'est utilisé nulle part dans le code
-- (l'acceptation se fait toujours après connexion) → simple suppression.
drop policy if exists team_inv_anon_read on team_invitations;

-- team_inv_update (using:true) laissait n'importe quel compte connecté accepter/modifier
-- l'invitation de n'importe qui d'autre. Remplacé par un scope sur l'email du compte connecté,
-- qui est la vraie condition pour accepter SA PROPRE invitation.
drop policy if exists team_inv_update on team_invitations;
create policy team_inv_update_own_email on team_invitations for update to authenticated using (
  email_invite = (auth.jwt() ->> 'email')
) with check (
  email_invite = (auth.jwt() ->> 'email')
);
-- Idem pour la lecture par token une fois connecté (nécessaire à processTeamInvite avant que
-- l'utilisateur soit membre de la structure, donc avant que team_inv_select ne s'applique) :
create policy team_inv_select_own_email on team_invitations for select to authenticated using (
  email_invite = (auth.jwt() ->> 'email')
);

-- lot_entreprises : lot_entreprises_select_public (public, using:true) exposait toute la table.
-- Le seul usage anonyme (showLotInviteBanner) a déjà un fallback prévu par le code si le SELECT
-- échoue (message générique sans nom de chantier/lot) — suppression sans remplacement nécessaire.
-- L'usage authentifié (processLotInvite) reste couvert par entreprise_lit_ses_invitations_lot
-- (entreprise_id = auth.uid(), déjà en place, les invitations lot_entreprises se font par id de
-- compte et non par email).
drop policy if exists lot_entreprises_select_public on lot_entreprises;

