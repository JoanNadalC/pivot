-- Bug pré-existant (sans rapport avec l'audit RLS) : inviter une entreprise déjà inscrite se fait
-- par entreprise_id (pas par email, voir selectionnerEntrepriseInvite dans pivot-moe.html), donc
-- email_invite est légitimement vide dans ce cas — mais la colonne était NOT NULL, ce qui faisait
-- échouer l'insertion.
alter table chantier_invitations alter column email_invite drop not null;
