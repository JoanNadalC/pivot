-- Audit RLS : liste toutes les policies actives sur toutes les tables du schéma public,
-- + indique si RLS est activé sur chaque table (une table sans RLS activé est TOTALEMENT ouverte
-- si elle est accessible via la clé anon, quelle que soit la policy).
-- Copie le résultat complet et renvoie-le pour analyse.

select
  t.tablename,
  t.rowsecurity as rls_enabled,
  p.policyname,
  p.cmd as operation,
  p.roles,
  p.qual as using_expression,
  p.with_check as check_expression
from pg_tables t
left join pg_policies p on p.tablename = t.tablename and p.schemaname = 'public'
where t.schemaname = 'public'
order by t.tablename, p.cmd;
