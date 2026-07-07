-- Masquage persistant des consultations dans Comparatif/Commande (partagé par chantier)
create table if not exists comparatif_masques (
  chantier_id uuid not null references chantiers(id) on delete cascade,
  consultation_id uuid not null references consultations(id) on delete cascade,
  primary key (chantier_id, consultation_id)
);
alter table comparatif_masques enable row level security;
create policy comparatif_masques_all on comparatif_masques for all to authenticated using (true) with check (true);

-- Commandes fournisseurs (figées à la création)
create table if not exists commandes (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  fournisseur_id uuid not null references fournisseurs(id),
  created_at timestamptz not null default now(),
  frais_port numeric default 0
);
create table if not exists commande_lignes (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes(id) on delete cascade,
  fourniture_id uuid not null references fournitures(id),
  consultation_id uuid references consultations(id),
  designation text,
  numero_poste text,
  unite text,
  qte numeric not null,
  prix_unit_ht numeric not null
);
alter table commandes enable row level security;
alter table commande_lignes enable row level security;
create policy commandes_all on commandes for all to authenticated using (true) with check (true);
create policy commande_lignes_all on commande_lignes for all to authenticated using (true) with check (true);
