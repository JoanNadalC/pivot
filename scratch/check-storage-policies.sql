-- Politiques actuelles sur le Storage, avant de restreindre la suppression des PDF de visa.
-- On veut savoir ce qui autorise aujourd'hui delete/update, pour ne restreindre que les visas
-- sans casser le remplacement de logo ni la suppression d'une fiche technique.
select polname,
       case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                   when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end as commande,
       polroles::regrole[] as roles,
       pg_get_expr(polqual, polrelid)      as using_expr,
       pg_get_expr(polwithcheck, polrelid) as with_check_expr
from pg_policy
join pg_class c     on c.oid = pg_policy.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage' and c.relname = 'objects'
order by commande, polname;
