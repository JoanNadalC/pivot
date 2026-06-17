# Pivot — Brief Claude Code
## Générateur DAF & DOE multi-corps d'état

---

## Contexte projet

Pivot est une plateforme SaaS BTP/paysage (3 portails : entrepreneur, fournisseur, maître d'œuvre).
Stack : GitHub Pages (frontend vanilla JS) + Supabase (base + storage) + Cloudflare Workers (edge functions).
Repo GitHub : JoanNadalC (username)

Ce brief couvre l'implémentation du générateur PDF DAF et DOE.

---

## Fichiers déjà produits dans ce dossier

- `worker.js` — Cloudflare Worker générateur PDF (pdf-lib), base DAF page 1 + annexes
- `daf-client.js` — client frontend pour appeler le worker
- `wrangler.toml` — config déploiement Cloudflare
- `package.json` — dépendances (pdf-lib, esbuild, wrangler)
- `SPEC_DAF_DOE_CORPS_ETAT.md` — spec complète familles, champs, pièces jointes par corps d'état

---

## Ce qu'il faut implémenter

### 1. Couleur de bandeau configurable (DAF + DOE)

Le bandeau sombre (#1a2e44 actuellement hardcodé dans worker.js) doit être paramétrable.

**Config stockée dans Supabase, table `chantier_config`** :
```json
{
  "chantier_id": "uuid",
  "bandeau_bg": "#1a2e44",
  "bandeau_text": "#ffffff",
  "logo_entrepreneur_url": "https://..."
}
```

Dans `worker.js`, remplacer les constantes `DARK_NAVY` et `WHITE` par les valeurs reçues dans le payload :
```json
{
  "config": {
    "bandeau_bg": "#0F6E56",
    "bandeau_text": "#ffffff"
  }
}
```

Palettes prédéfinies disponibles (à exposer aussi côté frontend) :
```js
const PALETTES = [
  { name: 'Marine',     bg: '#1a2e44', text: '#ffffff' },
  { name: 'Forêt',      bg: '#0F6E56', text: '#ffffff' },
  { name: 'Bleu',       bg: '#185fa5', text: '#ffffff' },
  { name: 'Violet',     bg: '#534AB7', text: '#ffffff' },
  { name: 'Terre',      bg: '#993C1D', text: '#ffffff' },
  { name: 'Anthracite', bg: '#444441', text: '#ffffff' },
  { name: 'Noir chaud', bg: '#2C2C2A', text: '#f0ede6' },
  { name: 'Sable',      bg: '#f1efe8', text: '#2C2C2A' },
];
```

---

### 2. Correction police accentuée — Noto Sans via KV (PRIORITÉ HAUTE)

`StandardFonts.Helvetica` ne supporte pas UTF-8. Noto Sans complète (~2 MB) dépasse la limite worker.

**Solution** : Noto Sans stockée dans Cloudflare KV, chargée à la demande. pdf-lib embarque automatiquement un subset des glyphes utilisés dans chaque PDF — multilingue sans surcoût.

#### Setup KV (une seule fois)

```bash
wrangler kv:namespace create FONTS
wrangler kv:key put --namespace-id=<KV_ID> "NotoSans-Regular" --path=./fonts/NotoSans-Regular.ttf
wrangler kv:key put --namespace-id=<KV_ID> "NotoSans-Bold"    --path=./fonts/NotoSans-Bold.ttf
```

`wrangler.toml` :
```toml
[[kv_namespaces]]
binding = "FONTS"
id = "<KV_NAMESPACE_ID>"
```

#### Dans worker.js

```js
async function loadFonts(env) {
  const [regularBytes, boldBytes] = await Promise.all([
    env.FONTS.get('NotoSans-Regular', { type: 'arrayBuffer' }),
    env.FONTS.get('NotoSans-Bold',    { type: 'arrayBuffer' }),
  ]);
  return { regularBytes, boldBytes };
}

// Dans le handler — remplace StandardFonts
const { regularBytes, boldBytes } = await loadFonts(env);
const regularFont = await pdfDoc.embedFont(regularBytes);
const boldFont    = await pdfDoc.embedFont(boldBytes);
```

pdf-lib subset automatiquement les glyphes à l'embed — le PDF final ne contient que les caractères utilisés dans le document. Fonctionne pour toutes les langues couvertes par Noto Sans sans modification.

#### Coûts

| Service | Plan | Coût |
|---|---|---|
| Workers KV (stockage fonts) | Gratuit — 1 GB inclus | 0 € |
| Workers CPU (génération PDF) | Paid requis (CPU > 10 ms) | **5 $/mois** |

---

### 3. Fiche fourniture DOE (sans validation)

Nouvelle fonction `buildFicheFournitureDOE()` dans `worker.js`.

Même mise en page que la DAF page 1 MAIS :
- Pas de section "Signatures"
- Pas de badge statut (visé / refusé)
- Colonne "Fabricant" dans le tableau à la place de "Famille"
- Champ "Date mise en œuvre" à la place de "Date émission"
- Label breadcrumb : `Pivot · DOE · Chap. {n} — {famille}`
- Pas de section "Fiches techniques annexées" (les FT sont dans les chapitres suivants)

Signature de la fonction :
```js
async function buildFicheFournitureDOE(pdfDoc, fonts, config, doeData, fiche, pageNum, totalPages)
```

Où `fiche` est :
```json
{
  "chapitre_num": 1,
  "chapitre_nom": "Fournitures CVC",
  "entrepreneur": "Verdalia SAS",
  "famille": "CVC",
  "date_mise_en_oeuvre": "Mai 2026",
  "lignes": [...],
  "livraison": { "fournisseur": "...", "livraison": "...", "garantie": "...", "maintenance": "..." }
}
```

---

### 4. Page manuelle DOE (éditeur de blocs)

Nouvelle fonction `buildPageManuelle()` dans `worker.js`.

Une page manuelle est composée de blocs ordonnés. Chaque bloc a un type :

#### Bloc texte
```json
{ "type": "texte", "titre": "Objet du document", "contenu": "Texte libre..." }
```
Rendu : titre en gras 9pt, contenu en 8.5pt avec retour à la ligne automatique (pdf-lib `drawText` avec `maxWidth` + `lineHeight`).

#### Bloc tableau
```json
{
  "type": "tableau",
  "titre": "Planning entretien",
  "colonnes": ["Opération", "Fréquence", "Intervenant", "Dernière date"],
  "lignes": [
    ["Entretien chaudière", "Annuelle", "Chauffagiste agréé", ""],
    ["Purge radiateurs", "Annuelle", "Gardien", ""]
  ]
}
```
Rendu : en-tête gris clair, alternance légère des lignes, colonnes de largeur égale dans la zone disponible.

#### Bloc liste
```json
{ "type": "liste", "titre": "Contacts SAV", "items": ["De Dietrich — 0800 100 105", "Thermique Pro 34 — 04 67 23 45 67"] }
```
Rendu : bullet point (•) 8pt + texte 8.5pt, interligne 1.4.

#### Bloc PDF uploadé
```json
{ "type": "pdf_upload", "nom": "Notice_Celegaz24.pdf", "base64": "JVBERi0x..." }
```
Rendu : pages du PDF source intégrées avec bandeau overlay (même logique que `buildAnnexPages`).

**Gestion de la pagination** : si le contenu d'une page manuelle dépasse une page A4, créer automatiquement les pages supplémentaires nécessaires avec le même bandeau + numérotation continue.

Signature :
```js
async function buildPageManuelle(pdfDoc, fonts, config, doeData, pageManuelle, startPageNum, totalPages)
// retourne le nombre de pages créées
```

---

### 5. Générateur DOE complet

Nouvelle fonction principale `buildDOE()` qui assemble le document complet :

```
Page 1           : Page de garde (buildPageDeGarde)
Pages 2..N       : Chapitres dans l'ordre configuré
  Chaque chapitre peut contenir :
    - Fiches fourniture DOE (buildFicheFournitureDOE) — auto depuis les DAF
    - PDFs uploadés avec bandeau overlay (buildAnnexPages existant)
    - Pages manuelles (buildPageManuelle)
```

#### Page de garde DOE

Mise en page :
- Bandeau sombre haut (couleur configurable) — ~35% hauteur page
  - Label "Pivot · Dossier des ouvrages exécutés"
  - Nom du chantier (grand, 18pt)
  - Adresse
  - Row métadonnées : Réf. DOE, date, nb pages, lots couverts
- Zone blanche milieu — 3 colonnes acteurs (Entrepreneur / MOE / MO)
  - Chaque colonne : logo (si dispo) + nom + contact
- Sommaire auto-généré
  - Liste des chapitres avec numéros de page calculés
  - Badges "N fiches" pour les chapitres fournitures
- Footer identique aux autres pages

Données page de garde :
```json
{
  "ref_doe": "DOE-CPCN-v2",
  "date_emission": "17 juin 2026",
  "chantier": "Résidence Les Capucines",
  "adresse": "147 avenue du Soleil, 34000 Montpellier",
  "entrepreneur": { "nom": "Verdalia SAS", "contact": "M. Dupont", "tel": "06 12 34 56 78", "email": "contact@verdalia.fr", "logo_base64": "..." },
  "moe": { "nom": "Atelier Vert & Co", "contact": "Mme Martin", "tel": "04 67 89 01 23", "email": "moe@ateliervert.fr", "logo_base64": "..." },
  "mo": { "nom": "Promo Sud Habitat", "contact": "M. Bernard", "tel": "04 67 00 11 22", "email": "bernard@promosud.fr", "logo_base64": "..." },
  "chapitres": [
    { "num": 1, "nom": "Fournitures CVC", "nb_fiches": 4, "page_debut": 2 },
    { "num": 2, "nom": "Plans réseaux CVC", "page_debut": 12 },
    ...
  ]
}
```

---

### 6. Schéma Supabase à créer/mettre à jour

```sql
-- Config couleurs et identité par chantier
CREATE TABLE chantier_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  bandeau_bg text DEFAULT '#1a2e44',
  bandeau_text text DEFAULT '#ffffff',
  logo_entrepreneur_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Config DOE par chantier
CREATE TABLE doe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  ref_doe text,
  chapitres jsonb DEFAULT '[]',  -- ordre + contenu des chapitres
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fichiers uploadés pour les chapitres DOE
CREATE TABLE doe_fichiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id uuid REFERENCES chantiers(id) ON DELETE CASCADE,
  chapitre_code text,  -- ex: 'CVC_plans', 'CVC_pv', 'custom_001'
  nom text,
  storage_path text,   -- chemin dans Supabase Storage
  nb_pages int,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

---

### 7. Endpoint worker — nouvelles routes

Ajouter une route `POST /generate-doe` dans `worker.js` en plus de `/generate-daf` :

```js
// Route dispatch
if (url.pathname === '/generate-daf') return handleDAF(request, env);
if (url.pathname === '/generate-doe') return handleDOE(request, env);
```

Payload `/generate-doe` :
```json
{
  "config": { "bandeau_bg": "#1a2e44", "bandeau_text": "#ffffff" },
  "doe": { ...données page de garde... },
  "chapitres": [
    {
      "num": 1,
      "nom": "Fournitures CVC",
      "type": "fournitures",
      "fiches": [ ...fiches fourniture DOE... ]
    },
    {
      "num": 2,
      "nom": "Plans réseaux CVC",
      "type": "pdfs",
      "fichiers": [ { "nom": "Plan_CVC.pdf", "base64": "..." } ]
    },
    {
      "num": 3,
      "nom": "Carnet d'entretien",
      "type": "manuel",
      "pages": [ ...pages manuelles avec blocs... ]
    }
  ]
}
```

---

### 8. Ordre d'implémentation recommandé

1. **Fix police accentuée** (Noto Sans) — ça débloque tout le reste
2. **Couleur bandeau configurable** dans `worker.js`
3. **`buildFicheFournitureDOE()`** — proche de buildPage1, retirer les sections visa/signatures
4. **`buildPageManuelle()`** — blocs texte + tableau + liste + pdf_upload
5. **`buildPageDeGarde()`** — page de garde DOE avec sommaire auto
6. **`buildDOE()`** — assembleur principal
7. **Route `/generate-doe`** + tests end-to-end
8. **Schéma Supabase** + migrations
9. **`daf-client.js`** — ajouter `generateDOE()` en miroir de `generateDAF()`

---

### 9. Tests à prévoir

```js
// test-daf.js — DAF avec accents, couleur custom, logo
// test-doe.js — DOE complet : page de garde + 3 chapitres (fournitures + pdf + manuel)
// Vérifier : pagination correcte, bandeau sur toutes les pages, accents OK
```

---

### Notes importantes

- **Jamais bloquer la génération** pour données manquantes — valeur vide = espace vide dans le PDF
- **pdf-lib** `drawText` ne wrap pas automatiquement — implémenter un wrapper manuel qui découpe le texte par mots et gère les retours à la ligne
- **Taille max worker Cloudflare** : 1 MB (free) / 10 MB (paid). Les fonts Noto en base64 font ~500 KB — prévoir le plan paid ou utiliser un KV store pour les assets
- Les PDFs uploadés peuvent être multi-pages — `annexPdf.getPageCount()` pour le calcul du total de pages
- Tester avec des PDFs A4 portrait ET landscape (certaines fiches fournisseur sont en landscape)
