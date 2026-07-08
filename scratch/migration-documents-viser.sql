-- Documents à viser (plans, etc.) uploadés par l'entreprise, visés par le MOE — même principe que les DAF
create table if not exists documents_viser (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  entrepreneur_id uuid not null references profiles(id),
  moe_id uuid references profiles(id),
  nom text not null,
  pdf_url text not null,
  pdf_visa_url text,
  statut text not null default 'soumise',
  version int not null default 1,
  parent_id uuid references documents_viser(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table documents_viser enable row level security;
create policy documents_viser_all on documents_viser for all to authenticated using (true) with check (true);

create table if not exists visa_documents (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents_viser(id) on delete cascade,
  moe_id uuid references profiles(id),
  type text not null,
  remarques text,
  date_visa timestamptz not null default now()
);
alter table visa_documents enable row level security;
create policy visa_documents_all on visa_documents for all to authenticated using (true) with check (true);
