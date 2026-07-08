-- chantier_invitations : deux policies laissaient lire TOUTE la table
--  - ch_inv_select_anon (rôle anon, using:true) : n'importe qui sur internet, sans être connecté
--  - entrepreneur_see_own_invitations (using: auth.uid() IS NOT NULL) : tout compte connecté, malgré son nom
-- La seule vraie utilisation anonyme est l'affichage du bandeau d'invitation avant connexion
-- (recherche par token). On la remplace par une fonction RPC qui ne renvoie que la ligne demandée,
-- sans exposer le reste de la table.

drop policy if exists ch_inv_select_anon on chantier_invitations;
drop policy if exists entrepreneur_see_own_invitations on chantier_invitations;

create or replace function get_chantier_invitation_public(p_token text)
returns table (nom_chantier text, email_invite text, statut text)
language sql
security definer
set search_path = public
as $$
  select nom_chantier, email_invite, statut
  from chantier_invitations
  where token = p_token
  limit 1;
$$;

revoke all on function get_chantier_invitation_public(text) from public;
grant execute on function get_chantier_invitation_public(text) to anon, authenticated;
