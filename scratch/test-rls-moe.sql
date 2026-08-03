-- Rejoue l'acceptation avec l'identité du MOE, pour voir ce que le RLS autorise réellement.
-- Encadré par begin/rollback : rien n'est écrit, c'est un test à blanc.
begin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"34b35a91-e973-41ac-a206-d7ce24163be0","role":"authenticated"}';

-- Contrôle préalable : l'identité est-elle bien prise en compte ?
select auth.uid() as identite_vue_par_postgres;

-- Le MOE voit-il son invitation ? (le `exists` de la politique en dépend)
select count(*) as invitations_visibles
from chantier_invitations
where moe_invited_id = auth.uid() and statut = 'pending';

-- Le chantier est-il visible en lecture ?
select count(*) as chantiers_visibles
from chantiers
where id = (select chantier_id from chantier_invitations
            where id = 'b583bb77-4267-44a1-a1ee-9e4108b3b604');

-- L'écriture passe-t-elle ? Zéro ligne = le RLS refuse.
update chantiers
   set moe_id = '34b35a91-e973-41ac-a206-d7ce24163be0'
 where id = (select chantier_id from chantier_invitations
             where id = 'b583bb77-4267-44a1-a1ee-9e4108b3b604')
returning id, affaire, moe_id;

rollback;
