-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 2, incrément 1 : rendre autonomes les pièces à conserver
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Un devis, une DAF visée, un document visé et une photo de fournisseur doivent survivre à la
-- disparition du chantier et du client. Or aujourd'hui ils n'existent que par leurs liens : sans
-- le chantier, on ne sait plus de quelle opération ils relèvent ; sans la consultation, ni pour
-- quelle demande ; sans le compte, ni pour quel client. Une pièce illisible ne vaut rien comme
-- preuve.
--
-- On recopie donc dans chaque pièce ce qu'il faut pour la lire seule — l'état des choses au moment
-- de son émission, ce qui est d'ailleurs la bonne valeur : un devis daté doit porter la raison
-- sociale que le client avait ce jour-là, non celle qu'il prendra plus tard.

-- ── 1. Les colonnes de contexte ─────────────────────────────────────────────
alter table reponses_fournisseurs
  add column if not exists ctx_chantier      text,
  add column if not exists ctx_consultation  text,
  add column if not exists ctx_client        text,
  add column if not exists ctx_fourniture    text;

alter table daf
  add column if not exists ctx_chantier text,
  add column if not exists ctx_client   text;

alter table documents_viser
  add column if not exists ctx_chantier text,
  add column if not exists ctx_client   text;

alter table photos_fournitures
  add column if not exists ctx_chantier    text,
  add column if not exists ctx_client      text,
  add column if not exists ctx_fourniture  text;

-- ── 2. Remplissage automatique à l'écriture ─────────────────────────────────
-- En trigger plutôt qu'en code portail : la pièce doit être lisible quel que soit le chemin qui
-- l'a créée, et quatre portails écrivent dans ces tables.
create or replace function public.remplir_contexte_piece()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chantier_id uuid;
  v_client_id uuid;
begin
  -- Chantier : direct pour daf et documents_viser, via la consultation pour les autres.
  if to_jsonb(new) ? 'chantier_id' then
    v_chantier_id := (to_jsonb(new) ->> 'chantier_id')::uuid;
  end if;
  if v_chantier_id is null and (to_jsonb(new) ? 'consultation_id') then
    select chantier_id into v_chantier_id from consultations
    where id = (to_jsonb(new) ->> 'consultation_id')::uuid;
  end if;

  if new.ctx_chantier is null and v_chantier_id is not null then
    select affaire into new.ctx_chantier from chantiers where id = v_chantier_id;
  end if;

  if new.ctx_client is null then
    if to_jsonb(new) ? 'entrepreneur_id' then
      v_client_id := (to_jsonb(new) ->> 'entrepreneur_id')::uuid;
    end if;
    if v_client_id is null and v_chantier_id is not null then
      select entrepreneur_id into v_client_id from chantiers where id = v_chantier_id;
    end if;
    if v_client_id is not null then
      select coalesce(nullif(raison_sociale,''), nullif(societe,''), nom)
        into new.ctx_client from compte_entrepreneur where id = v_client_id;
    end if;
  end if;

  -- Intitulés propres à chaque table.
  if tg_table_name = 'reponses_fournisseurs' then
    if new.ctx_consultation is null and new.consultation_id is not null then
      select titre into new.ctx_consultation from consultations where id = new.consultation_id;
    end if;
    if new.ctx_fourniture is null and new.fourniture_id is not null then
      select designation into new.ctx_fourniture from fournitures where id = new.fourniture_id;
    end if;
  elsif tg_table_name = 'photos_fournitures' then
    if new.ctx_fourniture is null and new.fourniture_id is not null then
      select designation into new.ctx_fourniture from fournitures where id = new.fourniture_id;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_ctx_reponses on reponses_fournisseurs;
create trigger trg_ctx_reponses before insert or update on reponses_fournisseurs
  for each row execute function public.remplir_contexte_piece();

drop trigger if exists trg_ctx_daf on daf;
create trigger trg_ctx_daf before insert or update on daf
  for each row execute function public.remplir_contexte_piece();

drop trigger if exists trg_ctx_documents on documents_viser;
create trigger trg_ctx_documents before insert or update on documents_viser
  for each row execute function public.remplir_contexte_piece();

drop trigger if exists trg_ctx_photos on photos_fournitures;
create trigger trg_ctx_photos before insert or update on photos_fournitures
  for each row execute function public.remplir_contexte_piece();

-- ── 3. Rattrapage de l'existant ─────────────────────────────────────────────
update reponses_fournisseurs r set
  ctx_chantier     = coalesce(r.ctx_chantier, ch.affaire),
  ctx_consultation = coalesce(r.ctx_consultation, c.titre),
  ctx_client       = coalesce(r.ctx_client, nullif(e.raison_sociale,''), nullif(e.societe,''), e.nom),
  ctx_fourniture   = coalesce(r.ctx_fourniture, f.designation)
from consultations c
left join chantiers ch on ch.id = c.chantier_id
left join compte_entrepreneur e on e.id = c.entrepreneur_id
left join fournitures f on f.id = r.fourniture_id
where c.id = r.consultation_id;

update daf d set
  ctx_chantier = coalesce(d.ctx_chantier, ch.affaire),
  ctx_client   = coalesce(d.ctx_client, nullif(e.raison_sociale,''), nullif(e.societe,''), e.nom)
from chantiers ch
left join compte_entrepreneur e on e.id = ch.entrepreneur_id
where ch.id = d.chantier_id;

update documents_viser dv set
  ctx_chantier = coalesce(dv.ctx_chantier, ch.affaire),
  ctx_client   = coalesce(dv.ctx_client, nullif(e.raison_sociale,''), nullif(e.societe,''), e.nom)
from chantiers ch
left join compte_entrepreneur e on e.id = ch.entrepreneur_id
where ch.id = dv.chantier_id;

update photos_fournitures p set
  ctx_chantier   = coalesce(p.ctx_chantier, ch.affaire),
  ctx_client     = coalesce(p.ctx_client, nullif(e.raison_sociale,''), nullif(e.societe,''), e.nom),
  ctx_fourniture = coalesce(p.ctx_fourniture, f.designation)
from consultations c
left join chantiers ch on ch.id = c.chantier_id
left join compte_entrepreneur e on e.id = c.entrepreneur_id
left join fournitures f on f.id = p.fourniture_id
where c.id = p.consultation_id;

-- ── 4. Contrôle ─────────────────────────────────────────────────────────────
select 'reponses sans contexte' as objet, count(*) from reponses_fournisseurs where ctx_chantier is null
union all select 'daf sans contexte', count(*) from daf where ctx_chantier is null
union all select 'documents sans contexte', count(*) from documents_viser where ctx_chantier is null
union all select 'photos sans contexte', count(*) from photos_fournitures where ctx_chantier is null;
