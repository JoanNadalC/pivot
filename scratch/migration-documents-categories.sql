-- Catégorie de document (PAQ/PAE, Plan masse, etc.)
alter table documents_viser add column if not exists categorie text;

-- Documents que le MOE exige pour un chantier donné
create table if not exists chantier_documents_requis (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  categorie text not null,
  created_at timestamptz not null default now(),
  unique(chantier_id, categorie)
);
alter table chantier_documents_requis enable row level security;
create policy chantier_documents_requis_all on chantier_documents_requis for all to authenticated using (true) with check (true);
