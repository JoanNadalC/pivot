-- La création de chantier par un maître d'œuvre relève de la formule Pilote. Le portail masque
-- désormais le bouton en Consultant, mais une interface se contourne : sans règle en base, la
-- restriction n'est qu'un affichage.
--
-- Fonction `security definer` : une sous-requête placée dans une politique s'exécuterait sous le
-- RLS de l'appelant, qui n'a aucun droit de lecture garanti sur `structures`.
create or replace function public.moe_est_pilote()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from structure_membres m
    join structures s on s.id = m.structure_id
    where m.user_id = auth.uid()
      and s.plan = 'pilote'
  );
$$;

revoke all on function public.moe_est_pilote() from public;
grant execute on function public.moe_est_pilote() to authenticated;

-- Politique RESTRICTIVE : elle se combine en ET avec les politiques d'insertion existantes, sans
-- avoir à les réécrire. Elle ne vise que les lignes qu'un maître d'œuvre se désigne à lui-même ;
-- les chantiers créés par une entreprise, où `moe_id` n'est pas l'appelant, ne sont pas concernés.
drop policy if exists "creation chantier moe reservee a pilote" on chantiers;
create policy "creation chantier moe reservee a pilote" on chantiers
  as restrictive for insert to authenticated
  with check (moe_id is distinct from auth.uid() or public.moe_est_pilote());
