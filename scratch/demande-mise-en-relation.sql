-- Réglage du fournisseur : accepter automatiquement les demandes de mise en relation d'une
-- entreprise, ou les valider manuellement une par une. Décoché par défaut (validation manuelle).
alter table compte_fournisseur add column if not exists acceptation_auto_relations boolean not null default false;
alter table compte_fournisseur alter column acceptation_auto_relations set default false;
update compte_fournisseur set acceptation_auto_relations = false where acceptation_auto_relations is distinct from false;

-- Statut du lien entreprise -> fournisseur : 'accepted' (par défaut, comportement historique et cas
-- où le fournisseur accepte auto) ou 'pending' (en attente de validation manuelle par le fournisseur).
alter table fournisseurs add column if not exists statut text not null default 'accepted';

-- Le fournisseur doit pouvoir accepter (update statut) ou refuser (delete) une demande le concernant,
-- ce qui manquait (seule la lecture de sa propre ligne était permise).
drop policy if exists fournisseur_update_sa_demande on fournisseurs;
create policy fournisseur_update_sa_demande on fournisseurs for update to authenticated using (
  compte_fournisseur_id = auth.uid() or fournisseur_portail_id = auth.uid()
) with check (
  compte_fournisseur_id = auth.uid() or fournisseur_portail_id = auth.uid()
);
drop policy if exists fournisseur_delete_sa_demande on fournisseurs;
create policy fournisseur_delete_sa_demande on fournisseurs for delete to authenticated using (
  (compte_fournisseur_id = auth.uid() or fournisseur_portail_id = auth.uid()) and statut = 'pending'
);

-- Permet à une entreprise de connaître le réglage d'un fournisseur (accepte auto ou non) sans avoir
-- accès en lecture au reste de sa ligne compte_fournisseur (RLS le lui interdit sinon).
create or replace function get_fournisseur_acceptation_auto(p_compte_id uuid)
returns boolean language sql security definer stable as $$
  select coalesce(acceptation_auto_relations, false) from compte_fournisseur where id = p_compte_id;
$$;
grant execute on function get_fournisseur_acceptation_auto(uuid) to authenticated;

-- Filigrane des photos prises via l'appli Pivot : réglage individuel par compte fournisseur
-- (référent ou membre), chacun choisit ce qui apparaît sur ses photos en plus de "Pivot la racine".
alter table compte_fournisseur add column if not exists filigrane_date boolean not null default true;
alter table compte_fournisseur add column if not exists filigrane_heure boolean not null default true;
alter table compte_fournisseur add column if not exists filigrane_localisation boolean not null default true;
