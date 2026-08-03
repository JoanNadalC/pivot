-- Recherche large (insensible à la casse/espaces) pour écarter un souci de normalisation d'email
select id, email, created_at, confirmed_at, raw_user_meta_data
from auth.users
where email ilike '%ouvrierphoto%';
