-- Corrige les policies "ALL / using:true" trouvées lors de l'audit qui laissent n'importe quel
-- compte connecté lire/écrire les données d'un autre chantier/fournisseur/entreprise.

-- demandes_modification : ALL, using:true → n'importe qui lit/modifie les demandes de n'importe qui.
drop policy if exists demandes_mod_access on demandes_modification;
create policy demandes_modification_select on demandes_modification for select to authenticated using (
  consultation_id in (select id from consultations where entrepreneur_id = auth.uid())
  or fournisseur_id in (select id from fournisseurs where fournisseur_portail_id = auth.uid() or compte_fournisseur_id = auth.uid())
  or fournisseur_id = auth.uid()
);
create policy demandes_modification_insert on demandes_modification for insert to authenticated with check (
  fournisseur_id in (select id from fournisseurs where fournisseur_portail_id = auth.uid() or compte_fournisseur_id = auth.uid())
  or fournisseur_id = auth.uid()
);
create policy demandes_modification_update on demandes_modification for update to authenticated using (
  consultation_id in (select id from consultations where entrepreneur_id = auth.uid())
) with check (
  consultation_id in (select id from consultations where entrepreneur_id = auth.uid())
);

-- notifications : notifications_insert_for_all (INSERT, check:true) permet à n'importe qui d'insérer
-- une notification dans le flux de N'IMPORTE QUEL utilisateur (risque de phishing interne).
-- La policy notifs_insert_related (déjà en place, scopée par chantier/consultation/daf/structure)
-- couvre les cas légitimes réels ; on retire seulement la policy sans restriction.
drop policy if exists notifications_insert_for_all on notifications;

-- photos_fournitures : insert/update/delete tous "true" → n'importe qui peut altérer les photos
-- de n'importe quel chantier. Remplacé par un scope sur le fournisseur propriétaire (mêmes colonnes
-- que les autres policies déjà correctes sur cette table).
drop policy if exists photos_insert on photos_fournitures;
drop policy if exists photos_update on photos_fournitures;
drop policy if exists photos_delete on photos_fournitures;
create policy photos_fournitures_insert on photos_fournitures for insert to authenticated with check (
  fournisseur_id in (select id from fournisseurs where fournisseur_portail_id = auth.uid() or compte_fournisseur_id = auth.uid())
  or fournisseur_id = auth.uid()
);
create policy photos_fournitures_update on photos_fournitures for update to authenticated using (
  fournisseur_id in (select id from fournisseurs where fournisseur_portail_id = auth.uid() or compte_fournisseur_id = auth.uid())
  or fournisseur_id = auth.uid()
  or consultation_id in (select id from consultations where entrepreneur_id = auth.uid())
);
create policy photos_fournitures_delete on photos_fournitures for delete to authenticated using (
  fournisseur_id in (select id from fournisseurs where fournisseur_portail_id = auth.uid() or compte_fournisseur_id = auth.uid())
  or fournisseur_id = auth.uid()
  or consultation_id in (select id from consultations where entrepreneur_id = auth.uid())
);

-- demandes_photos : collab_update_demandes_photos (UPDATE, using:true) → n'importe qui peut modifier
-- n'importe quelle demande. Remplacé par : le fournisseur propriétaire, ou un collaborateur assigné.
drop policy if exists collab_update_demandes_photos on demandes_photos;
create policy demandes_photos_update_scoped on demandes_photos for update to authenticated using (
  fournisseur_id in (select id from fournisseurs where fournisseur_portail_id = auth.uid() or compte_fournisseur_id = auth.uid())
  or exists (select 1 from collaborateurs c where c.auth_user_id = auth.uid() and c.id = any(demandes_photos.assignee_ids))
);

-- daf : "entrepreneur insert daf" (INSERT, check:true) → n'importe qui peut créer une DAF sur le
-- chantier d'un autre. Restreint à l'entrepreneur propriétaire du chantier OU à une entreprise
-- invitée sur un lot de ce chantier (chantier_intervenants), même logique que notifs_insert_related.
drop policy if exists "entrepreneur insert daf" on daf;
create policy daf_insert_owner on daf for insert to authenticated with check (
  entrepreneur_id = auth.uid()
  and chantier_id in (
    select id from chantiers where entrepreneur_id = auth.uid()
    union
    select chantier_id from chantier_intervenants where entrepreneur_id = auth.uid()
  )
);
