-- 1) La politique a-t-elle bien été créée ?
select polname, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy join pg_class c on c.oid = pg_policy.polrelid
where c.relname = 'chantiers' and polname = 'moe_accepte_invitation';

-- 2) L'invitation est-elle bien en attente, et le MOE désigné est-il celui qui se connecte ?
--    Remplace l'email par celui du compte MOE utilisé pour le test.
select ci.id            as invitation_id,
       ci.statut,
       ci.moe_invited_id,
       p.email          as moe_designe,
       c.affaire,
       c.moe_id         as moe_actuel_du_chantier
from chantier_invitations ci
join chantiers c on c.id = ci.chantier_id
left join profiles p on p.id = ci.moe_invited_id
where ci.moe_invited_id is not null
order by ci.created_at desc
limit 5;

-- 3) Le compte MOE serait-il en accès restreint ? La politique restrictive posée hier
--    bloquerait alors toute écriture, indépendamment de la politique ci-dessus.
--    Remplace par l'identifiant du compte MOE (colonne moe_invited_id ci-dessus).
-- select public.structure_restreinte('COLLE_ICI_LE_moe_invited_id');
