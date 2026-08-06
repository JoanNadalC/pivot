# Règles du projet Pivot

Registre des décisions énoncées par Joan, à relire **avant toute modification** et à compléter dès
qu'une règle nouvelle est posée. Il ne décrit pas le code : il dit ce que le code ne doit pas
trahir. `SPECS_PIVOT_COMPLET.md` est le cahier des charges d'origine — historique, non tenu à jour.

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
pièce ne détruit pas le précédent.

**Les pièces contractuelles survivent à leur contexte.** Un devis validé, une DAF visée, un document
visé restent accessibles à leur auteur même après le départ du client et la suppression du chantier.
Chacun porte une copie du contexte (`ctx_chantier`, `ctx_client`…) recopiée à l'émission — l'état
des choses ce jour-là, non celui d'aujourd'hui.

---

## 2. Codification des fichiers créés

Réglable par chantier (`chantier_config.code_format`, `code_separateur`), avec une **règle unique**
pour les DAF et les documents à viser — pas deux listes à tenir accordées.

Ordre par défaut retenu à l'usage : `ville`, `chantier`, `entreprise`, `poste`, `objet`, `version`,
séparateur `_`. La ville et le chantier situent la pièce avant qu'on sache de quoi elle parle :
c'est ainsi qu'on cherche un document des années après.

Une brique sans valeur est **omise**, sans laisser de séparateur orphelin — le numéro de poste,
absent d'un document, ne doit pas produire `__`.

Le fichier déposé porte la référence, pas son nom d'origine.

---

## 3. Écritures et RLS

**Toute écriture est vérifiée.** supabase-js *renvoie* les erreurs au lieu de les lever, et un
`UPDATE` qui ne touche aucune ligne renvoie `{data: [], error: null}`. Un refus RLS ne se signale
donc jamais. Utiliser `_ecrire` (visible) ou `_discret` (journalisé), et `.select()` + contrôle du
nombre de lignes quand le succès importe.

**Ce dont dépend une écriture se lit sans jointure.** Une jointure imbriquée PostgREST fait tomber
la requête entière si le RLS interdit la table liée. Les jointures ne servent qu'à l'ornement, et
leur absence doit rester sans conséquence.

**Le temps réel exige la publication.** Une table absente de `supabase_realtime` rend l'abonnement
muet, sans erreur. Configuration de base, absente du dépôt.

---

## 4. Consultations

**Le périmètre est figé à l'envoi** (`fournitures_ids`). Une fourniture ajoutée au DQE après coup
ne s'invite pas dans une consultation déjà partie.

**Le filtre de familles exclut ce qui n'est pas classé.** Cocher « Végétaux » ne doit pas soumettre
le chantier entier sous prétexte qu'une ligne n'a pas de famille. Une variante suit la famille de sa
ligne mère.

**Les certifications sont une exigence, pas une description.** L'entreprise les exige par ligne ; le
fournisseur déclare, ligne par ligne, ce qu'il détient. L'écart figure au comparatif **et** au devis
PDF — « Certifié : … » / « Sans certification : … ». Rien sur les variantes : le fournisseur n'y a
pas de case à cocher.

---

## 5. Interface

**Ce qui n'appartient pas au tableau se détache du tableau.** La demande à un collaborateur, interne
à la société du fournisseur et sans effet sur le devis, est séparée par une gouttière et posée sur
son propre fond.

**Téléverser n'est pas soumettre.** On choisit un fichier, on voit la référence qu'il portera, puis
on soumet — c'est le seul moment où l'on peut encore corriger.

**Un échec se dit.** Un dépôt manqué, une notification refusée, un devis non produit : l'utilisateur
doit l'apprendre à l'écran, jamais en console.

---

## 6. Terminologie

Selon le type de compte : société / établissement / agence pour entrepreneur, fournisseur, MOE.
Nom et raison sociale sont deux champs distincts, dans tous les portails.

---

## 7. Exploitation

Les portails se déploient par `git push` (Cloudflare Pages). Le worker se déploie séparément :

```bash
cd worker && npx wrangler deploy
```

Les migrations SQL sont exécutées à la main dans l'éditeur Supabase, et **données en entier dans le
fil de la conversation** — jamais un renvoi vers un fichier.

Ne jamais purger les structures « Espaces verts dupont », « Pepiniere Adrienne », « La Racine ».
