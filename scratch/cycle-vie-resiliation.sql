-- Cycle de vie après résiliation : actif → résilié → restreint (lecture + export) → supprimé.
-- Sans date de référence, aucun délai n'est calculable : on horodate la fin d'abonnement.
alter table structures add column if not exists resilie_le timestamptz;

-- Accès restreint : le compte reste consultable et exportable, mais plus modifiable. Distinct de
-- compte_bloque, qui est une suspension manuelle décidée par l'admin (impayé, litige) et coupe tout.
alter table structures add column if not exists acces_restreint boolean not null default false;

-- Horodatage de la purge, pour garder la trace comptable d'une structure dont les données métier
-- ont été effacées (le RGPD n'impose pas de conserver ces données, mais la facturation oui).
alter table structures add column if not exists donnees_supprimees_le timestamptz;

-- Évite d'envoyer deux fois l'avertissement « suppression dans 7 jours ».
alter table structures add column if not exists avert_suppression_envoye boolean not null default false;

-- Les structures déjà résiliées avant cette migration n'ont pas de date : on prend leur dernière
-- mise à jour connue plutôt que de les laisser sans référence (elles resteraient éternellement actives).
update structures
   set resilie_le = coalesce(resilie_le, now())
 where statut_abonnement = 'resilie' and resilie_le is null;
