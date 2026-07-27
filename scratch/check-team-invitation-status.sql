-- 1. Vérifier l'état de l'invitation par email
select id, structure_id, email_invite, token, statut, created_at
from team_invitations
where email_invite = 'REMPLACE_PAR_EMAIL_ICI'
order by created_at desc;

-- 2. Vérifier si un compte a bien été créé pour cet email (auth.users)
select id, email, created_at, confirmed_at
from auth.users
where email = 'REMPLACE_PAR_EMAIL_ICI';
