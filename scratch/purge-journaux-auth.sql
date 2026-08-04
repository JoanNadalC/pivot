-- Purge des journaux d'authentification au-delà de six mois.
--
-- La politique de confidentialité annonce cette durée : sans purge, l'engagement ne serait pas
-- tenu. Supabase ne supprime jamais `auth.audit_log_entries` de lui-même — la table grossit
-- indéfiniment.
--
-- Six mois est la durée recommandée par la CNIL pour les journaux de connexion. Elle laisse le
-- recul nécessaire à une analyse de sécurité sans conserver au-delà de la finalité.
--
-- `security definer` car le schéma `auth` n'appartient pas au rôle appelant. L'exécution est
-- réservée à `service_role` : cette fonction efface des traces de sécurité, aucun compte
-- utilisateur ne doit pouvoir la déclencher.
create or replace function public.purger_journaux_auth()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from auth.audit_log_entries
  where created_at < now() - interval '6 months';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.purger_journaux_auth() from public;
revoke all on function public.purger_journaux_auth() from authenticated, anon;
grant execute on function public.purger_journaux_auth() to service_role;
