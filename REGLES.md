# Règles du projet Pivot

Registre des décisions énoncées par Joan, à relire **avant toute modification** et à compléter dès
qu'une règle nouvelle est posée. Il ne décrit pas le code : il dit ce que le code ne doit pas
trahir. `SPECS_PIVOT_COMPLET.md` est le cahier des charges d'origine — historique, non tenu à jour.

`FAIBLESSES.md` tient le registre de ce qui est connu comme défaillant et non réparé.

Les tests de `tests/` vérifient mécaniquement celles de ces règles qui s'y prêtent :

```bash
node tests/run.js
```

---

## 1. Pièces contractuelles

**Une pièce émise ne se régénère pas.** Sa référence, son contenu et son nom de fichier sont figés
au moment de l'émission. La codification peut changer ensuite : les pièces antérieures gardent la
leur, parce qu'elles circulent en dehors de Pivot — courriels, dossiers d'archives, DOE.

**Une DAF visée n'est jamais régénérée par l'entreprise.** Le seul document visé auquel l'entreprise
a accès est celui produit par le maître d'œuvre depuis son portail (`pdf_visa_url`) : c'est
exactement le PDF soumis par l'entreprise, auquel le MOE ajoute sa page de visa. Le bouton de
téléchargement côté entreprise sert ce fichier-là, et lui seul.

**Un visa engage une personne au nom d'une société.** Toute pièce visée porte la raison sociale, le
prénom et le nom du signataire, sa fonction si elle est connue, et la date. Une adresse email seule
ne vaut pas signature.

**Un visa ne s'écrase pas.** Chaque visa a son propre fichier horodaté ; viser à nouveau la même
pièce ne détruit pas le précédent. Ni la modification ni la suppression du fichier ne sont
permises ; seule la purge d'un compte y touche.

**Les pièces contractuelles survivent à leur contexte.** Un devis validé, une DAF visée, un document
visé restent accessibles à leur auteur même après le départ du client et la suppression du chantier.
Chacun porte une copie du contexte (`ctx_chantier`, `ctx_client`…) recopiée à l'émission — l'état
des choses ce jour-là, non celui d'aujourd'hui.

**Une DAF en brouillon n'existe pas pour le maître d'œuvre.** C'est un travail en cours côté
entreprise, sur lequel il n'a aucune action possible. Il ne la voit ni dans sa liste, ni en direct.

**Les fiches techniques annexées font partie de la pièce.** Elles sont incorporées au PDF, une photo
par page — pas de mise en page multi-photos, par robustesse.

---

## 2. Conservation et suppression

**L'unité de suppression est le chantier, pas la structure.** Un chantier réunit plusieurs
participants ; le départ de l'un n'efface pas le dossier des autres. Il n'est supprimé que lorsque
le dernier participant est parti, ou à l'échéance de dix ans.

**Deux couches.** La couche *partagée* — chantier, fournitures, DAF soumises et visées, documents
visés, commandes — survit tant qu'un participant reste. La couche *privée* — carnet fournisseurs,
prix reçus, comparatifs, notes, tarifs non transmis — part avec son propriétaire. Un maître d'œuvre
ne doit jamais hériter des prix consentis à une entreprise disparue.

**Pièces à double propriétaire** : devis validé, DAF visée, document visé, photos de fournitures.
Pas concernés : DAF non visée, DOE, fiches techniques, logo, devis non validé.

**Une purge est transactionnelle.** Tout passe ou rien ne passe. Ce qui ne peut pas entrer dans la
transaction — fichiers du Storage, comptes d'authentification — est consigné dans `purge_restes`
avant de rendre la main.

**Une résiliation ouvre deux délais, pas un.** Le premier ferme les fonctionnalités ; le second,
plus long, laisse le dossier complet téléchargeable avant que les données partent. Le courriel de
résiliation annonce ces dates. Un compte résilié garde l'accès à son portail : il n'y fait plus
rien, il emporte ses dossiers.

**L'archive se lit sans Pivot.** Elle est organisée en dossiers de chantier, pas en tables, et ne
porte que des noms et des désignations — jamais des identifiants. Une pièce reçue y figure même si
personne ne l'a jamais ouverte à l'écran.

---

## 3. Codification des fichiers créés

Réglable par chantier (`chantier_config.code_format`, `code_separateur`), avec une **règle unique**
pour les DAF et les documents à viser — pas deux listes à tenir accordées.

Ordre par défaut retenu à l'usage : `ville`, `chantier`, `entreprise`, `poste`, `objet`, `version`,
séparateur `_`. La ville et le chantier situent la pièce avant qu'on sache de quoi elle parle :
c'est ainsi qu'on cherche un document des années après.

Une brique sans valeur est **omise**, sans laisser de séparateur orphelin — le numéro de poste,
absent d'un document, ne doit pas produire `__`.

Le fichier déposé porte la référence, pas son nom d'origine.

Un réglage ne vaut que pour la suite : changer la codification, ou la couleur d'un statut, ne
retouche pas ce qui existe déjà.

---

## 4. Écritures et RLS

**Toute écriture est vérifiée.** supabase-js *renvoie* les erreurs au lieu de les lever, et un
`UPDATE` qui ne touche aucune ligne renvoie `{data: [], error: null}`. Un refus RLS ne se signale
donc jamais. Utiliser `_ecrire` (visible) ou `_discret` (journalisé), et `.select()` + contrôle du
nombre de lignes quand le succès importe.

**Ce dont dépend une écriture se lit sans jointure.** Une jointure imbriquée PostgREST fait tomber
la requête entière si le RLS interdit la table liée. Les jointures ne servent qu'à l'ornement, et
leur absence doit rester sans conséquence.

**Le temps réel exige la publication.** Une table absente de `supabase_realtime` rend l'abonnement
muet, sans erreur. Configuration de base, absente du dépôt.

**Une identité se lit du compte, pas de la fiche.** Un fournisseur a autant de fiches de carnet que
de clients : filtrer par fiche ne montre qu'une part de ses données, et plus rien du tout quand le
client s'en va. Filtrer par `compte_fournisseur_id`.

---

## 5. Droits et confidentialité

**Les recherches d'acteurs passent par une RPC masquée.** Un compte ne publie que ce qu'il a choisi
de rendre visible, et la visibilité distingue deux niveaux : la simple présence au carnet n'ouvre
que le public, le rattachement à un chantier vaut relation établie.

**Celui qui a créé le chantier maîtrise ses intervenants.** Si le maître d'œuvre a créé le chantier
et invité l'entreprise, celle-ci ne peut ni changer ni retirer le MOE — boutons masqués *et* garde
défensive dans le code, jamais l'un sans l'autre.

**Le portail MOE gratuit (Consultant) ne crée pas de chantier** : c'est une fonction du forfait
Pilote.

**Une entité ne modifie pas les données d'une autre.** Dès qu'un contact a son propre compte, sa
raison sociale, son nom, son SIRET, ses coordonnées ne sont modifiables que par lui. La seule chose
qui reste à celui qui range est le classement par famille, qui n'appartient qu'à son carnet.

**On n'entre pas dans le carnet de quelqu'un sans son accord.** Sélectionner un acteur d'un autre
portail envoie une demande de mise en relation. L'acceptation automatique existe, mais c'est un
choix explicite, décoché par défaut. Le rattachement d'un maître d'œuvre à un chantier suppose la
relation établie.

**Par défaut, un compte ne publie que son entreprise, sa ville et ses initiales.** Le reste — nom,
prénom, fonction, téléphone, courriel — ne paraît que s'il l'a coché, et le réglage distingue les
contacts déjà en relation des autres.

**Le prix d'étude ne quitte pas l'entreprise.** Il n'apparaît ni à l'import ni au tableau de
fournitures du portail MOE. Les frais de port ne sortent pas du comparatif et de la commande.

**Le référent seul invite et retire.** Un collaborateur voit l'équipe et les invitations en cours,
il n'y touche pas. Les informations de la société descendent du référent vers ses collaborateurs,
qui ne modifient que leurs propres coordonnées.

**Un invité n'est membre qu'une fois son compte créé.** Avant cela, il figure dans l'équipe avec la
mention d'attente. Un compte administrateur peut gérer les licences sans licence lui-même — c'est
la place d'un responsable informatique ou d'un secrétariat.

**On invite un compte, ou on crée une fiche.** Pas de lien d'invitation à faire circuler : soit
l'invité a un compte et on le trouve dans le portail, soit on crée une fiche de contact et Pivot
lui envoie un courriel d'inscription ; à la création du compte, la fiche existante lui est
rapprochée. Un compte déjà existant ne se rattache pas tout seul : cela passe par
`contact@pivotlaracine.com`.

**La mesure d'usage se limite au comptage.** Un compteur de connexions par mois et par compte,
annoncé aux conditions générales — rien de plus fin.

---

## 6. Consultations

**Le périmètre est figé à l'envoi** (`fournitures_ids`). Une fourniture ajoutée au DQE après coup
ne s'invite pas dans une consultation déjà partie.

**Le filtre de familles exclut ce qui n'est pas classé.** Cocher « Végétaux » ne doit pas soumettre
le chantier entier sous prétexte qu'une ligne n'a pas de famille. Une variante suit la famille de sa
ligne mère.

**Les certifications sont une exigence, pas une description.** L'entreprise les exige par ligne ; le
fournisseur déclare, ligne par ligne, ce qu'il détient. L'écart figure au comparatif **et** au devis
PDF — « Certifié : … » / « Sans certification : … ». Rien sur les variantes : le fournisseur n'y a
pas de case à cocher.

**Les fournitures et les DAF sont cadrées par lot** (`fournitures.lot_id`). Les invitations se font
par identifiant de compte, jamais par email.

**Un prix ne se choisit qu'une fois par fourniture.** La même fourniture peut paraître dans
plusieurs consultations — c'est utile, on consulte à nouveau. Mais un seul prix est retenu au
total, et retenir le second libère le premier en le disant. Une variante ne prend pas de place à
elle : elle occupe celle de sa ligne mère. Ainsi une fourniture n'entre que dans une commande.

**Ce que l'utilisateur a rangé reste rangé.** Prix retenus, consultations masquées : l'état
survit au changement d'onglet et à la session suivante, et le comparatif et la commande montrent
le même.

**Chacun sa colonne.** Les documents joints par l'entreprise éclairent la demande et paraissent
dans les spécifications requises ; la colonne fiche technique reste au fournisseur, qui y joint ce
qu'il envoie avec sa réponse.

**Une photo ne part chez le client qu'une fois validée par le fournisseur.** Le collaborateur
photographie et déclare terminé, fourniture par fourniture ; le fournisseur regarde, valide ou
redemande. L'entreprise ne voit que ce qui a été validé.

---

## 7. Import d'un DQE

Un **chapitre** est une ligne sans quantité *et* sans prix — critère unique, la numérotation de poste
produisant trop de faux positifs. La ligne prime sur le contexte du chapitre : substrat, puis
végétaux, puis contexte hérité. La comparaison de titres se fait sans accents et en minuscules.

Le conditionnement se cherche dans cet ordre : désignation de la ligne, colonne Unité, titre du
chapitre.

---

## 8. Interface

**Ce qui n'appartient pas au tableau se détache du tableau.** La demande à un collaborateur, interne
à la société du fournisseur et sans effet sur le devis, est séparée par une gouttière et posée sur
son propre fond.

**Téléverser n'est pas soumettre.** On choisit un fichier, on voit la référence qu'il portera, puis
on soumet — c'est le seul moment où l'on peut encore corriger.

**Un échec se dit.** Un dépôt manqué, une notification refusée, un devis non produit : l'utilisateur
doit l'apprendre à l'écran, jamais en console.

**Aucun dialogue natif.** `confirm()` et `prompt()` sont remplacés partout par `showConfirm` /
`showPrompt`.

**Un refus de la base se traduit en français.** Une contrainte violée, une politique RLS qui bloque :
l'utilisateur lit une phrase qui dit ce qui l'empêche, pas le message de PostgreSQL.

**Ce qu'on ne peut pas faire s'explique.** Un contact déjà au carnet qu'on ne peut pas
resélectionner, une croix qui ne supprime rien parce qu'on n'est pas le référent : le motif se lit
sur place, sinon l'écran passe pour cassé.

**Ce qui sert à se repérer reste visible.** Les onglets et les en-têtes de tableau tiennent sous la
bannière quand la page défile.

**Les versions s'empilent sous leur ligne.** La fourniture ou le document en tête, puis V1, puis
V2, du même corps et sans gras — et les colonnes des documents à viser s'alignent sur celles des
fournitures.

**Le suivi montre aussi ce qui n'est pas fait.** Toutes les fournitures y figurent, y compris
celles sans DAF : c'est là qu'on voit le travail restant. Si le maître d'œuvre n'utilise pas Pivot,
l'entreprise renseigne elle-même l'émission, la date de visa et l'observation.

---

## 9. Terminologie

Selon le type de compte : **société** (entrepreneur), **établissement** (fournisseur), **agence**
(MOE). La table reste `structures` en base — c'est un mot d'administration, pas un mot d'utilisateur.

Nom et raison sociale sont deux champs distincts, dans tous les portails.

Le nom du produit s'écrit « Pivot. la racine » — un point, « la racine » en minuscules, le tout sur
une seule ligne. Les tirets cadratins sont bannis des titres d'onglets, où le point les remplace.

---

## 10. Exploitation

Les portails se déploient par `git push` (Cloudflare Pages). Le worker se déploie séparément :

```bash
cd worker && npx wrangler deploy
```

Les migrations SQL sont exécutées à la main dans l'éditeur Supabase, et **données en entier dans le
fil de la conversation** — jamais un renvoi vers un fichier.

Ne jamais purger les structures « Espaces verts dupont », « Pepiniere Adrienne », « La Racine ».

**Une faiblesse se dit.** Ce qui est bancal, incertain ou à moitié fait doit être annoncé, même si
cela alourdit la réponse : taire un défaut par souci d'efficacité coûte plus cher que de
l'énoncer. `FAIBLESSES.md` tient ce registre.

**Ce qui fonctionne ne doit pas cesser de fonctionner.** Des outils éprouvés se sont défaits au fil
des modifications ; c'est la raison d'être des vérifications de `tests/`, qu'on complète à mesure
que des règles nouvelles s'y prêtent.

---

## 11. Notifications et courriels

Tout courriel envoyé par Pivot porte la charte du site — y compris ceux que Supabase enverrait par
défaut : confirmation d'inscription, réinitialisation de mot de passe, invitation.

Chacun règle sa fréquence : à chaque événement, récapitulatif quotidien, ou hebdomadaire. Le
récapitulatif se lit par chantier, et dans chaque chantier par catégorie.

**Une notification lue ne disparaît pas.** Elle grise, et ne s'efface que sur demande. Cliquer
dessus mène à l'endroit exact de l'événement, pas à un écran vide.

**Le classement suit la dernière notification.** Dans les trois portails, la carte dont l'événement
est le plus récent remonte en tête — sans quoi une affaire déjà répondue, rangée plus bas, ne serait
jamais revue.

---

## 12. Catalogue du fournisseur

Chaque pépinière a son propre catalogue ; la bibliothèque de référence (Telabotanica, importée par
l'administrateur) ne sert qu'à rapprocher les noms et à éviter la ressaisie. Un végétal y admet
plusieurs déclinaisons — port, taille, conditionnement.

La mise à jour de la bibliothèque de référence ne doit jamais désorganiser les catalogues déjà
constitués.
