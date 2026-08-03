-- Le MOE ne pouvait pas accepter une invitation de chantier.
--
-- Les politiques d'écriture sur `chantiers` sont `entrepreneur_id = auth.uid()` et
-- `moe_id = auth.uid()`. Au moment d'accepter, moe_id est encore NULL : aucune des deux ne
-- correspond, la mise à jour ne touche aucune ligne — et PostgREST ne signale AUCUNE erreur
-- dans ce cas. L'invitation était donc marquée acceptée sans que le rattachement ait lieu.
--
-- On autorise l'écriture quand une invitation en attente désigne ce MOE pour ce chantier.
-- Le `with check` garantit qu'il ne peut se désigner que lui-même : impossible de rattacher
-- le chantier à un tiers. Une fois accepté, moe_update_chantiers prend le relais.
drop policy if exists moe_accepte_invitation on chantiers;
create policy moe_accepte_invitation on chantiers
  for update to authenticated
  using (
    exists (
      select 1 from chantier_invitations ci
      where ci.chantier_id = chantiers.id
        and ci.moe_invited_id = auth.uid()
        and ci.statut = 'pending'
    )
  )
  with check (moe_id = auth.uid());

-- ── Réparation des invitations acceptées à vide ───────────────────────────────
-- Les invitations passées en « accepted » alors que le rattachement avait échoué doivent
-- redevenir « pending » pour pouvoir être acceptées de nouveau.
-- Vérifier d'abord ce qui sera touché :
--   select ci.id, ci.statut, c.affaire, c.moe_id
--   from chantier_invitations ci join chantiers c on c.id = ci.chantier_id
--   where ci.moe_invited_id is not null and ci.statut = 'accepted' and c.moe_id is null;

update chantier_invitations ci
   set statut = 'pending', accepted_at = null
  from chantiers c
 where c.id = ci.chantier_id
   and ci.moe_invited_id is not null
   and ci.statut = 'accepted'
   and c.moe_id is null;
