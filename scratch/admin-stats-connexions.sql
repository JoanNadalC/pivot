-- Statistiques de connexion, réservées à l'administrateur de la plateforme.
--
-- Finalités : sécurité du service, détection d'accès anormaux et suivi des licences facturées mais
-- inutilisées. Base légale : intérêt légitime de l'éditeur (RGPD art. 6.1.f).
--
-- Ces données ne sont PAS exposées aux référents de structure sur leurs collaborateurs : cela
-- relèverait du contrôle de l'activité des salariés, avec information individuelle, consultation
-- du CSE et exigence de proportionnalité. Le périmètre reste l'exploitation du service.
--
-- Minimisation : ni adresse IP, ni agent utilisateur, ni horodatage page à page. Aucune collecte
-- nouvelle non plus — tout est déjà tenu par Supabase pour le fonctionnement de l'authentification.
--
-- Note : `auth.audit_log_entries` reste vide sur ce projet, Supabase ne journalisant pas les
-- événements d'authentification. Un décompte des connexions sur trente jours en tirerait zéro pour
-- tout le monde. On s'en tient donc à la dernière connexion, fiable, et au nombre de sessions
-- ouvertes, qui distingue un compte réellement utilisé d'un compte connecté une fois.

-- Le schéma `auth` n'est pas interrogeable depuis les portails, qui utilisent la session de
-- l'utilisateur. D'où une fonction `security definer` — qui doit vérifier elle-même que l'appelant
-- est administrateur, sans quoi elle ouvrirait à tous ce qu'elle est censée protéger.
drop function if exists public.admin_stats_connexions();
create or replace function public.admin_stats_connexions()
returns table (
  user_id uuid,
  email text,
  cree_le timestamptz,
  derniere_connexion timestamptz,
  sessions_actives bigint,
  jours_depuis_connexion int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Réservé à l''administrateur.' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from auth.sessions s where s.user_id = u.id),
    case when u.last_sign_in_at is null then null
         else extract(day from now() - u.last_sign_in_at)::int end
  from auth.users u
  order by u.last_sign_in_at desc nulls last;
end $$;

revoke all on function public.admin_stats_connexions() from public;
grant execute on function public.admin_stats_connexions() to authenticated;
