-- Documents à viser (plans, PAQ/PAE, etc.) — script complet, idempotent (peut être relancé sans erreur)

-- 1. Table des documents envoyés par l'entreprise
create table if not exists documents_viser (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  entrepreneur_id uuid not null references profiles(id),
  moe_id uuid references profiles(id),
  nom text not null,
  categorie text,
  pdf_url text not null,
  pdf_visa_url text,
  statut text not null default 'soumise',
  version int not null default 1,
  parent_id uuid references documents_viser(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table documents_viser add column if not exists categorie text;
alter table documents_viser add column if not exists pdf_visa_url text;
alter table documents_viser add column if not exists parent_id uuid references documents_viser(id) on delete set null;

alter table documents_viser enable row level security;
drop policy if exists documents_viser_all on documents_viser;
create policy documents_viser_all on documents_viser for all to authenticated using (true) with check (true);

-- 2. Table des VISA donnés par le MOE sur ces documents
create table if not exists visa_documents (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents_viser(id) on delete cascade,
  moe_id uuid references profiles(id),
  type text not null,
  remarques text,
  date_visa timestamptz not null default now()
);
alter table visa_documents enable row level security;
drop policy if exists visa_documents_all on visa_documents;
create policy visa_documents_all on visa_documents for all to authenticated using (true) with check (true);

-- 3. Documents que le MOE exige pour un chantier donné (catégorie fixe + nom précis, ex. "Plan" -> "Plan de masse")
create table if not exists chantier_documents_requis (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  categorie text not null,
  nom text,
  created_at timestamptz not null default now()
);
alter table chantier_documents_requis add column if not exists nom text;
alter table chantier_documents_requis drop constraint if exists chantier_documents_requis_chantier_id_categorie_key;

alter table chantier_documents_requis enable row level security;
drop policy if exists chantier_documents_requis_all on chantier_documents_requis;
create policy chantier_documents_requis_all on chantier_documents_requis for all to authenticated using (true) with check (true);
