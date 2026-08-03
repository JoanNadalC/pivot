select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('compte_entrepreneur', 'compte_moe', 'compte_fournisseur')
order by table_name, ordinal_position;
