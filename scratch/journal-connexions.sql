-- Journal des connexions, pour mesurer l'usage réel des licences facturées.
--
-- Supabase ne remplit pas `auth.audit_log_entries` sur ce projet : la fréquence de connexion n'est
-- récupérable nulle part. On la tient donc nous-mêmes — mais au grain du JOUR, pas de la session.
--
-- Ce choix n'est pas une approximation par défaut. Compter les sessions surcompterait les onglets,
-- les rafraîchissements de jeton et les reconnexions automatiques, sans rien dire de plus sur
-- l'usage. Un décompte de jours d'activité répond exactement à la question posée — ce compte
-- sert-il ? — tout en conservant strictement moins de données. La contrainte d'unicité rend
-- l'enregistrement idempotent : quinze connexions dans la journée laissent une seule ligne.
create table if not exists connexions_journal (
  user_id uuid not null references auth.users(id) on delete cascade,
  portail text not null,
  jour date not null default current_date,
  primary key (user_id, portail, jour)
);

create index if not exists idx_connexions_journal_jour on connexions_journal (jour);

alter table connexions_journal enable row level security;

-- Chacun n'inscrit que sa propre connexion, et sur la date du jour : sans cette seconde condition,
-- un compte pourrait fabriquer un historique d'activité qui n'a pas eu lieu.
drop policy if exists "journal insert sa propre connexion" on connexions_journal;
create policy "journal insert sa propre connexion" on connexions_journal
  for insert to authenticated
  with check (user_id = auth.uid() and jour = current_date);

-- Personne ne lit cette table depuis un portail. L'administrateur y accède par la fonction
-- agrégée ci-dessous, qui vérifie son rôle ; les référents de structure n'y accèdent pas du tout,
-- conformément à l'engagement pris dans la politique de confidentialité.

-- Statistiques d'activité, réservées à l'administrateur de la plateforme.
drop function if exists public.admin_stats_connexions();
create or replace function public.admin_stats_connexions()
returns table (
  user_id uuid,
  email text,
  cree_le timestamptz,
  derniere_connexion timestamptz,
  jours_actifs_30j bigint,
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
    (select count(*) from connexions_journal j
      where j.user_id = u.id and j.jour > current_date - 30),
    (select count(*) from auth.sessions s where s.user_id = u.id),
    case when u.last_sign_in_at is null then null
         else extract(day from now() - u.last_sign_in_at)::int end
  from auth.users u
  order by u.last_sign_in_at desc nulls last;
end $$;

revoke all on function public.admin_stats_connexions() from public;
grant execute on function public.admin_stats_connexions() to authenticated;

-- Purge à six mois, la durée annoncée dans la politique de confidentialité. La fonction existante
-- vise `auth.audit_log_entries` ; elle traite désormais aussi ce journal, et reste appelée chaque
-- jour par la tâche planifiée du worker.
create or replace function public.purger_journaux_auth()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  m integer;
begin
  delete from auth.audit_log_entries where created_at < now() - interval '6 months';
  get diagnostics n = row_count;
  delete from connexions_journal where jour < current_date - 180;
  get diagnostics m = row_count;
  return n + m;
end $$;

revoke all on function public.purger_journaux_auth() from public;
revoke all on function public.purger_journaux_auth() from authenticated, anon;
grant execute on function public.purger_journaux_auth() to service_role;
