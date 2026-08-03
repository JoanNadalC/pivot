-- 1) La politique existe-t-elle bien maintenant ?
select polname, pg_get_expr(polqual, polrelid) as using_expr,
       pg_get_expr(polwithcheck, polrelid) as with_check_expr
from pg_policy join pg_class c on c.oid = pg_policy.polrelid
where c.relname = 'chantiers' and polname = 'moe_accepte_invitation';

-- 2) Le compte MOE est-il considéré en accès restreint ? Doit renvoyer false.
select public.structure_restreinte('34b35a91-e973-41ac-a206-d7ce24163be0') as moe_restreint;

-- 3) Le MOE peut-il LIRE ses invitations ? C'est le point clé : le `exists` de la politique
--    s'exécute avec ses droits, donc une lecture refusée rend la condition fausse.
select polname,
       case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                   when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end as commande,
       polpermissive as permissive,
       polroles::regrole[] as roles,
       pg_get_expr(polqual, polrelid) as using_expr
from pg_policy join pg_class c on c.oid = pg_policy.polrelid
where c.relname = 'chantier_invitations'
order by commande, polname;
