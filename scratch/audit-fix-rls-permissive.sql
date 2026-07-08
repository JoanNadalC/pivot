-- Corrige les policies trop permissives introduites cette session (for all to authenticated using (true)),
-- qui laissaient n'importe quel compte connecté lire/écrire les données de N'IMPORTE QUEL chantier.
-- Remplace par un scope réel : propriétaire du chantier (entrepreneur_id) ou MOE du chantier (moe_id).

-- comparatif_masques
drop policy if exists comparatif_masques_all on comparatif_masques;
create policy comparatif_masques_select on comparatif_masques for select to authenticated using (
  exists (select 1 from chantiers c where c.id = comparatif_masques.chantier_id and (c.entrepreneur_id = auth.uid() or c.moe_id = auth.uid()))
);
create policy comparatif_masques_write on comparatif_masques for all to authenticated using (
  exists (select 1 from chantiers c where c.id = comparatif_masques.chantier_id and c.entrepreneur_id = auth.uid())
) with check (
  exists (select 1 from chantiers c where c.id = comparatif_masques.chantier_id and c.entrepreneur_id = auth.uid())
);

-- commandes
drop policy if exists commandes_all on commandes;
create policy commandes_select on commandes for select to authenticated using (
  exists (select 1 from chantiers c where c.id = commandes.chantier_id and (c.entrepreneur_id = auth.uid() or c.moe_id = auth.uid()))
);
create policy commandes_write on commandes for all to authenticated using (
  exists (select 1 from chantiers c where c.id = commandes.chantier_id and c.entrepreneur_id = auth.uid())
) with check (
  exists (select 1 from chantiers c where c.id = commandes.chantier_id and c.entrepreneur_id = auth.uid())
);

-- commande_lignes (scope via la commande parente)
drop policy if exists commande_lignes_all on commande_lignes;
create policy commande_lignes_select on commande_lignes for select to authenticated using (
  exists (
    select 1 from commandes cmd join chantiers c on c.id = cmd.chantier_id
    where cmd.id = commande_lignes.commande_id and (c.entrepreneur_id = auth.uid() or c.moe_id = auth.uid())
  )
);
create policy commande_lignes_write on commande_lignes for all to authenticated using (
  exists (
    select 1 from commandes cmd join chantiers c on c.id = cmd.chantier_id
    where cmd.id = commande_lignes.commande_id and c.entrepreneur_id = auth.uid()
  )
) with check (
  exists (
    select 1 from commandes cmd join chantiers c on c.id = cmd.chantier_id
    where cmd.id = commande_lignes.commande_id and c.entrepreneur_id = auth.uid()
  )
);

-- documents_viser
drop policy if exists documents_viser_all on documents_viser;
create policy documents_viser_select on documents_viser for select to authenticated using (
  entrepreneur_id = auth.uid() or moe_id = auth.uid()
  or exists (select 1 from chantiers c where c.id = documents_viser.chantier_id and c.moe_id = auth.uid())
);
create policy documents_viser_insert on documents_viser for insert to authenticated with check (
  entrepreneur_id = auth.uid()
);
create policy documents_viser_update on documents_viser for update to authenticated using (
  entrepreneur_id = auth.uid()
  or exists (select 1 from chantiers c where c.id = documents_viser.chantier_id and c.moe_id = auth.uid())
) with check (
  entrepreneur_id = auth.uid()
  or exists (select 1 from chantiers c where c.id = documents_viser.chantier_id and c.moe_id = auth.uid())
);

-- visa_documents (scope via le document)
drop policy if exists visa_documents_all on visa_documents;
create policy visa_documents_select on visa_documents for select to authenticated using (
  exists (
    select 1 from documents_viser d where d.id = visa_documents.document_id
    and (d.entrepreneur_id = auth.uid() or d.moe_id = auth.uid())
  )
);
create policy visa_documents_insert on visa_documents for insert to authenticated with check (
  exists (
    select 1 from documents_viser d join chantiers c on c.id = d.chantier_id
    where d.id = visa_documents.document_id and c.moe_id = auth.uid()
  )
);

-- chantier_documents_requis
drop policy if exists chantier_documents_requis_all on chantier_documents_requis;
create policy chantier_documents_requis_select on chantier_documents_requis for select to authenticated using (
  exists (select 1 from chantiers c where c.id = chantier_documents_requis.chantier_id and (c.entrepreneur_id = auth.uid() or c.moe_id = auth.uid()))
);
create policy chantier_documents_requis_write on chantier_documents_requis for insert to authenticated with check (
  exists (select 1 from chantiers c where c.id = chantier_documents_requis.chantier_id and c.moe_id = auth.uid())
);
create policy chantier_documents_requis_delete on chantier_documents_requis for delete to authenticated using (
  exists (select 1 from chantiers c where c.id = chantier_documents_requis.chantier_id and c.moe_id = auth.uid())
);
