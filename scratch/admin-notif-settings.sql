-- Réglages des notifications admin : quelles catégories d'événements déclenchent une notification,
-- et à quelle fréquence (each = immédiat par email, daily/weekly = récap différé, none = jamais).
create table if not exists admin_notif_settings (
  id uuid primary key default gen_random_uuid(),
  categorie text not null unique,
  actif boolean not null default true,
  frequence text not null default 'each'
);
insert into admin_notif_settings (categorie, actif, frequence) values
  ('chat', true, 'each'),
  ('inscription', true, 'each'),
  ('resiliation', true, 'each')
on conflict (categorie) do nothing;

alter table admin_notif_settings enable row level security;
create policy admin_notif_settings_admin_only on admin_notif_settings for all to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
) with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
