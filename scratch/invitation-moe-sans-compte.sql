-- Invitation d'un MOE qui n'a pas encore de compte.
--
-- L'entrepreneur crée une fiche dans son carnet et déclenche un email d'inscription. L'invitation
-- est enregistrée sur l'adresse email, faute de compte à désigner. Quand le MOE s'inscrit, il faut
-- rattacher ce qui l'attendait — sinon il arrive sur un portail vide et l'entrepreneur voit une
-- invitation éternellement en attente.
--
-- Le rapprochement DOIT se faire ici, dans un trigger `security definer`, et non depuis le
-- navigateur du nouvel inscrit : son compte ne peut pas lire les fiches créées par d'autres, le RLS
-- les lui cache. Une tentative côté client ne remonterait aucune erreur et ne ferait simplement
-- rien — le piège déjà rencontré cinq fois sur ce projet.

create or replace function public.rapprocher_invitations_moe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
begin
  if v_email = '' then return new; end if;

  -- Les invitations chantier adressées à cette adresse désignent désormais le compte créé.
  -- Elles restent en attente : le rapprochement établit le lien, pas le consentement — le MOE
  -- accepte ou refuse depuis son portail, comme pour une invitation nominative.
  update chantier_invitations
  set moe_invited_id = new.id
  where moe_invited_id is null
    and statut = 'pending'
    and lower(trim(coalesce(email_invite, ''))) = v_email;

  -- Les fiches de carnet créées par des entrepreneurs pointent maintenant vers le vrai compte :
  -- elles cessent d'être des contacts morts et deviennent invitables.
  update maitres_oeuvre
  set compte_moe_id = new.id
  where compte_moe_id is null
    and lower(trim(coalesce(email, ''))) = v_email;

  return new;
end $$;

drop trigger if exists trg_rapprocher_invitations_moe on compte_moe;
create trigger trg_rapprocher_invitations_moe
  after insert on compte_moe
  for each row execute function public.rapprocher_invitations_moe();

-- Le profil MOE est créé par `upsert` à l'inscription : si la ligne existait déjà (compte recréé,
-- reprise d'inscription), l'insert ne se déclenche pas. On couvre le cas où l'email arrive après.
drop trigger if exists trg_rapprocher_invitations_moe_maj on compte_moe;
create trigger trg_rapprocher_invitations_moe_maj
  after update of email on compte_moe
  for each row
  when (old.email is distinct from new.email)
  execute function public.rapprocher_invitations_moe();

-- Rattrapage des fiches déjà créées avant ce trigger.
update maitres_oeuvre m
set compte_moe_id = c.id
from compte_moe c
where m.compte_moe_id is null
  and coalesce(m.email,'') <> ''
  and lower(trim(m.email)) = lower(trim(coalesce(c.email,'')));
