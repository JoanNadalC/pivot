-- ═══════════════════════════════════════════════════════════════════════════
-- Fin du test 3 : retour à l'accès normal
-- ═══════════════════════════════════════════════════════════════════════════
update structures set acces_restreint = false where acces_restreint = true;


-- ═══════════════════════════════════════════════════════════════════════════
-- Test 4 : purge d'une structure arrivée à échéance
--
-- La purge est IRRÉVERSIBLE : elle efface les données métier, les fichiers du
-- Storage et les comptes des membres. À ne jouer que sur une structure jetable.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Choisir la cible. Ne JAMAIS prendre « Espaces verts dupont ».
select s.id, s.nom, s.type, s.statut_abonnement, s.resilie_le, s.donnees_supprimees_le,
       (select count(*) from structure_membres m where m.structure_id = s.id) as membres,
       (select count(*) from chantiers c where c.entreprise_id = s.referent_id) as chantiers
from structures s
order by s.cree_le desc;

-- 2. Placer la cible dans l'état qui rend la purge possible : résiliée depuis
--    plus de 90 jours. Le bouton n'apparaît qu'à cette condition, et le worker
--    revérifie les trois critères côté serveur — l'un ne dispense pas de l'autre.
--    Remplacer <STRUCTURE_ID> par l'id relevé ci-dessus.
update structures
set statut_abonnement = 'resilie',
    resilie_le = now() - interval '95 days',
    donnees_supprimees_le = null
where id = '<STRUCTURE_ID>';

-- 3. Photographier l'état AVANT purge, pour pouvoir comparer ensuite.
--    Remplacer <STRUCTURE_ID> (deux fois).
select 'membres' as objet, count(*) from structure_membres where structure_id = '<STRUCTURE_ID>'
union all
select 'chantiers', count(*) from chantiers
  where entreprise_id in (select compte_id from structure_membres where structure_id = '<STRUCTURE_ID>');

-- 4. Purger depuis le portail admin : onglet Structures → 🧹 Purger,
--    recopier le nom exact de la structure, confirmer.

-- 5. Vérifier APRÈS purge :
--    - les deux compteurs de l'étape 3 sont à zéro ;
--    - donnees_supprimees_le est renseigné ;
--    - la fiche de structure existe toujours (conservation comptable) avec
--      referent_id à null ;
--    - dans Storage, les buckets ne contiennent plus les fichiers de la structure ;
--    - dans Authentication, les comptes des membres ont disparu.
select id, nom, statut_abonnement, resilie_le, donnees_supprimees_le, referent_id
from structures where id = '<STRUCTURE_ID>';
