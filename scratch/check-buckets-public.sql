-- Question décisive avant toute correction : ces buckets sont-ils publics ?
-- Un bucket public sert ses fichiers à quiconque connaît l'URL, SANS passer par le RLS.
-- Dans ce cas les politiques SELECT ne protègent rien et il faut soit passer le bucket en privé
-- (avec des URL signées), soit accepter que la confidentialité repose sur le secret de l'URL.
select id, name, public, file_size_limit, created_at
from storage.buckets
order by name;
