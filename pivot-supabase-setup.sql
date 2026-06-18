-- ============================================================
-- PIVOT LA RACINE — Setup Supabase
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Créer la table profiles liée aux utilisateurs Auth
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('entreprise', 'fournisseur', 'moe')),
  nom        text,
  prenom     text,
  created_at timestamptz default now()
);

-- 2. Activer RLS
alter table public.profiles enable row level security;

-- 3. Politique : chaque utilisateur ne peut lire que son propre profil
create policy "Lecture profil personnel"
  on public.profiles for select
  using (auth.uid() = id);

-- 4. Créer le profil automatiquement à chaque inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'entreprise')
  );
  return new;
end;
$$;

-- 5. Déclencher la fonction à chaque nouvel utilisateur Auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- CRÉER UN UTILISATEUR MANUELLEMENT (exemples)
-- À utiliser depuis Supabase > Authentication > Users
-- après avoir créé l'utilisateur, mettre à jour son rôle :
-- ============================================================

-- Mettre à jour le rôle d'un utilisateur existant :
-- update public.profiles set role = 'moe' where id = 'UUID_DE_LUTILISATEUR';
-- update public.profiles set role = 'fournisseur' where id = 'UUID_DE_LUTILISATEUR';
-- update public.profiles set role = 'entreprise' where id = 'UUID_DE_LUTILISATEUR';
