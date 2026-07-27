select conname, conrelid::regclass as table_from, confrelid::regclass as table_to,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f'
  and (
    (conrelid = 'consultations'::regclass and confrelid = 'chantiers'::regclass)
    or (conrelid = 'chantiers'::regclass and confrelid = 'consultations'::regclass)
  );
