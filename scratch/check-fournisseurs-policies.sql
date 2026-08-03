select polname, polcmd, polpermissive, polroles::regrole[], pg_get_expr(polqual, polrelid) as using_expr, pg_get_expr(polwithcheck, polrelid) as with_check_expr
from pg_policy
join pg_class on pg_class.oid = pg_policy.polrelid
where pg_class.relname = 'fournisseurs';
