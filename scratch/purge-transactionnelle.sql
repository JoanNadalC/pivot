-- ═══════════════════════════════════════════════════════════════════════════
-- Purge d'une structure : une seule transaction, tri par couche
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La purge enchaînait des appels REST. Son échec au milieu laissait la structure à demi effacée,
-- sans moyen de savoir où l'opération s'était arrêtée — c'est arrivé lors du test du 5 août. Une
-- fonction s'exécute en une transaction : tout passe ou rien ne passe.
--
-- Elle intègre aussi le tri par couche. La couche privée de l'entreprise part ; les pièces qui
-- appartiennent aussi à un tiers restent, leurs liens s'annulant au lieu de les emporter. Les
-- triggers `nettoyer_avant_suppression_*` posés à l'incrément 2 font ce tri à la suppression du
-- chantier : la fonction n'a pas à le refaire, seulement à ne pas le contourner.
--
-- Les fichiers et les comptes d'authentification ne peuvent pas entrer dans la transaction : ils
-- vivent hors de la base. La fonction renvoie donc la liste des fichiers à effacer et des comptes
-- à supprimer, que le worker traite ensuite. Ce découpage est volontaire — mieux vaut un fichier
-- orphelin qu'une base à demi purgée.

create or replace function public.purger_structure(p_structure_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_struct structures%rowtype;
  v_jours int;
  v_membres uuid[];
  v_chantiers uuid[];
  v_consultations uuid[];
  v_fichiers text[] := '{}';
  v_conserves int := 0;
  v_compte jsonb := '{}'::jsonb;
  n int;
begin
  select * into v_struct from structures where id = p_structure_id;
  if not found then raise exception 'Structure introuvable.'; end if;
  if v_struct.donnees_supprimees_le is not null then
    raise exception 'Les données de cette structure ont déjà été supprimées.';
  end if;
  if v_struct.statut_abonnement <> 'resilie' then
    raise exception 'Cette structure n''est pas résiliée.';
  end if;
  v_jours := floor(extract(epoch from now() - v_struct.resilie_le) / 86400);
  if v_struct.resilie_le is null or v_jours < 90 then
    raise exception 'Délai non écoulé : % jour(s) depuis la résiliation, 90 requis.', coalesce(v_jours, 0);
  end if;

  select coalesce(array_agg(user_id), '{}') into v_membres
    from structure_membres where structure_id = p_structure_id;

  select coalesce(array_agg(id), '{}') into v_chantiers
    from chantiers where entrepreneur_id = any(v_membres);

  select coalesce(array_agg(id), '{}') into v_consultations
    from consultations where chantier_id = any(v_chantiers);

  -- ── Fichiers de la couche privée, relevés avant que les lignes ne partent ──
  -- Une pièce visée ou un devis émis n'y figure pas : ils survivent à l'entreprise.
  select coalesce(array_agg(u), '{}') into v_fichiers from (
    select pdf_url as u from daf
      where chantier_id = any(v_chantiers) and pdf_visa_url is null and pdf_url is not null
    union
    select url from documents_viser
      where chantier_id = any(v_chantiers) and pdf_visa_url is null and url is not null
    union
    select pdf_url from documents_viser
      where chantier_id = any(v_chantiers) and pdf_visa_url is null and pdf_url is not null
    union
    select devis_pdf_url from reponses_fournisseurs
      where entrepreneur_id = any(v_membres) and devis_valide_at is null and devis_pdf_url is not null
    union
    select ft ->> 'url' from fournitures f, jsonb_array_elements(
             case when jsonb_typeof(f.fiches_techniques) = 'array'
                  then f.fiches_techniques else '[]'::jsonb end) ft
      where f.chantier_id = any(v_chantiers) and ft ->> 'url' is not null
  ) s where u is not null;

  select count(*) into v_conserves from (
    select 1 from daf where chantier_id = any(v_chantiers) and pdf_visa_url is not null
    union all
    select 1 from documents_viser where chantier_id = any(v_chantiers) and pdf_visa_url is not null
    union all
    select 1 from reponses_fournisseurs
      where entrepreneur_id = any(v_membres) and devis_valide_at is not null
    union all
    select 1 from photos_fournitures where consultation_id = any(v_consultations)
  ) c;

  -- ── Suppression de la couche privée ───────────────────────────────────────
  -- Ces tables ne se rattachent pas au chantier et ne partiraient pas d'elles-mêmes.
  delete from comparatif_selections where consultation_id = any(v_consultations);
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('comparatif_selections', n);

  delete from comparatif_selections
   where fourniture_id in (select id from fournitures where chantier_id = any(v_chantiers));
  get diagnostics n = row_count;
  v_compte := jsonb_set(v_compte, '{comparatif_selections}',
              to_jsonb((v_compte ->> 'comparatif_selections')::int + n));

  delete from comparatif_masques where chantier_id = any(v_chantiers);
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('comparatif_masques', n);

  delete from commande_lignes
   where commande_id in (select id from commandes where chantier_id = any(v_chantiers));
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('commande_lignes', n);

  delete from commandes where chantier_id = any(v_chantiers);
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('commandes', n);

  -- Le carnet et les notifications appartiennent en propre à l'entreprise.
  delete from fournisseurs where entrepreneur_id = any(v_membres);
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('fournisseurs', n);

  delete from maitres_oeuvre where entrepreneur_id = any(v_membres);
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('maitres_oeuvre', n);

  delete from notifications where user_id = any(v_membres);
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('notifications', n);

  -- ── Les chantiers, qui entraînent le reste ────────────────────────────────
  -- Les triggers `nettoyer_avant_suppression_*` retirent au passage les pièces sans visa ni devis
  -- émis ; celles qui en ont voient simplement leur lien s'annuler.
  delete from chantiers where id = any(v_chantiers);
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('chantiers', n);

  -- ── Clôture ───────────────────────────────────────────────────────────────
  update structures
     set donnees_supprimees_le = now(), referent_id = null
   where id = p_structure_id;

  delete from structure_membres where structure_id = p_structure_id;
  get diagnostics n = row_count; v_compte := v_compte || jsonb_build_object('membres', n);

  return jsonb_build_object(
    'structure', v_struct.nom,
    'supprimees', v_compte,
    'pieces_conservees', v_conserves,
    'fichiers', to_jsonb(v_fichiers),
    'comptes', to_jsonb(v_membres)
  );
end $$;

revoke all on function public.purger_structure(uuid) from public;
revoke all on function public.purger_structure(uuid) from authenticated, anon;
grant execute on function public.purger_structure(uuid) to service_role;
