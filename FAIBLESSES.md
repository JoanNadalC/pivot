# Faiblesses connues

Ce que je sais et qui n'est pas réparé, classé par ce que ça coûterait si ça arrivait. Rien ici
n'est une hypothèse : chaque point a été constaté. À relire avant d'ouvrir un chantier — certaines
lignes sont l'affaire de dix minutes.

Dernière revue : 6 août 2026.

---

## Grave — à traiter en priorité

### Les fichiers de six buckets sont publics
`daf-pdfs`, `doe-fichiers`, `doe-pdfs`, `fiches-techniques`, `logos`, `photos-fournitures` ont
`public = true`. Quiconque possède l'URL lit le fichier, sans compte et sans droit — et ces URL
circulent par mail, dans les notifications, dans les DOE. Une DAF porte des prix, un fournisseur
retenu, l'identité du chantier. Seul `devis-fournisseurs` est privé et servi par URL signée.

Le portail sait déjà lire un bucket privé (`ouvrirFichierProtege` signe l'URL). Le passage au privé
demande de vérifier chaque point de lecture, y compris le worker et les PDF annexés.

### N'importe quel compte peut écrire une notification à n'importe qui
La politique `notifications_insert_for_all` est permissive avec `with check true`. Une politique
permissive suffit à autoriser : la politique fine `notifs_insert_related`, posée à côté, ne restreint
donc rien. Un compte authentifié peut adresser à un autre un message de son choix, en se donnant
l'apparence de Pivot.

Corriger demande d'abord d'étendre `notifs_insert_related` aux cas qu'elle ne couvre pas —
`relation_acceptee` n'a ni chantier ni consultation — puis de supprimer la politique large.

### La purge n'est pas atomique de bout en bout
La cascade en base est transactionnelle depuis le 5 août. Mais les fichiers du Storage et les
comptes d'authentification vivent hors de la base : ils sont consignés dans `purge_restes` et
repris par la tâche planifiée. Entre les deux, un compte peut rester connectable alors que ses
données sont parties.

---

## Sérieux — à traiter bientôt

### La configuration Supabase n'est pas dans le dépôt
Politiques RLS, publication temps réel, buckets, fonctions : tout est saisi à la main dans
l'éditeur. Un nouvel environnement — préproduction, reprise après incident — repart sans rien, et
les symptômes sont muets (un abonnement non publié se connecte et ne reçoit jamais rien). Il
n'existe aucun inventaire exportable de ce qui est en place.

### Les déclencheurs de lot n'ont jamais été essayés
`clore_participation_intervenant` et `retirer_entreprise_du_lot` sont écrits et posés, jamais
exercés sur un chantier réel. Ils touchent à la suppression.

### Trois visas sans PDF
Trois DAF visées avant la correction du chemin de stockage n'ont pas de pièce signée. Le visa est
enregistré, le document n'existe pas.

### Les tests ne couvrent que des fonctions pures
`node tests/run.js` vérifie la syntaxe et une poignée de règles calculables. Rien ne teste le RLS,
les politiques de stockage, ni le comportement des portails dans un navigateur — or c'est là que
sont nées presque toutes les pannes de ces deux semaines.

---

## Mineur — à savoir

- Le compteur `badge-relations` ne s'allume jamais.
- L'onglet « Tarifs » du portail admin est vide.
- Les écritures des rangs 3 et 4 du balayage (notifications, préférences) restent en
  `console.error` — c'était un choix, mais il masque les refus, comme on l'a vu ce soir.
- `SPECS_PIVOT_COMPLET.md` est le cahier des charges d'origine et décrit une architecture
  abandonnée (GitHub Pages, jsPDF). Il induit en erreur quiconque le lit comme une référence.
- Le label choisi à la création d'une consultation n'apparaît pas côté fournisseur — signalé le
  5 août, jamais élucidé : enregistré et non affiché, ou perdu à l'envoi ?

---

## Ce qui manque encore au modèle de conservation

La table des participants et la survie du chantier lui-même — le point de départ du modèle, resté
non fait. Puis la phase 3 : échéance à dix ans, préavis d'un mois, archive téléchargeable.
