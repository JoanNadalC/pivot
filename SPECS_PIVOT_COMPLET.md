# PIVOT — Cahier des charges complet v1.0
*Plateforme de gestion des achats de chantier*

---

## 1. VISION GÉNÉRALE

Pivot est une plateforme web de gestion des achats de chantier destinée aux entreprises de paysage et BTP. Elle centralise les consultations fournisseurs, les demandes d'agrément fournitures (DAF), les validations maître d'œuvre (VISA) et la génération du Dossier des Ouvrages Exécutés (DOE).

**3 portails, 3 acteurs :**
| Portail | Fichier | Acteur |
|---------|---------|--------|
| `pivot-entrepreneur.html` | Entrepreneur / Conducteur de travaux |
| `pivot-fournisseur.html` | Fournisseur / Pépinière |
| `pivot-moe.html` | Maître d'œuvre |

---

## 2. ARCHITECTURE TECHNIQUE

- **Frontend** : 3 fichiers HTML autonomes (CSS + JS inline)
- **Backend** : Supabase (nouveau projet)
- **Hébergement** : GitHub Pages (nouveau repo)
- **Edge Functions** : Supabase (notifications email via Resend)
- **IA** : Claude Haiku via proxy Cloudflare (import devis, détection familles)
- **PDF** : Génération côté client (jsPDF ou html2pdf)
- **Stockage fichiers** : Supabase Storage (fiches techniques PDF)

---

## 3. SCHÉMA SUPABASE

### 3.1 Comptes utilisateurs

```sql
-- Entrepreneurs
compte_entrepreneur (
  id uuid PK DEFAULT auth.uid(),
  nom text, societe text, email text,
  siret text, tva_intra text,
  adresse_complete text, telephone text,
  logo_url text, langue text DEFAULT 'fr',
  delai_paiement text, penalites_retard text,
  mentions_legales text, bc_counter int DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- Fournisseurs
compte_fournisseur (
  id uuid PK DEFAULT auth.uid(),
  fournisseur_id uuid FK→fournisseurs.id,
  nom text, nom_entreprise text, email text,
  tel text, adresse text, siret text,
  notif_preference text DEFAULT 'each', -- 'each'|'daily'|'none'
  langue text DEFAULT 'fr',
  created_at timestamptz DEFAULT now()
)

-- Maîtres d'œuvre
compte_moe (
  id uuid PK DEFAULT auth.uid(),
  nom text, societe text, email text,
  tel text, adresse text,
  langue text DEFAULT 'fr',
  created_at timestamptz DEFAULT now()
)

-- Carnet de fournisseurs de l'entrepreneur
fournisseurs (
  id uuid PK DEFAULT gen_random_uuid(),
  entrepreneur_id uuid FK→compte_entrepreneur.id,
  nom text, email text, tel text,
  adresse text, notes text,
  familles text[],  -- familles de produits proposées
  created_at timestamptz DEFAULT now()
)
```

### 3.2 Chantiers et fournitures

```sql
-- Chantiers
chantiers (
  id uuid PK DEFAULT gen_random_uuid(),
  entrepreneur_id uuid FK→compte_entrepreneur.id,
  moe_id uuid FK→compte_moe.id,  -- null si pas de MOE
  moe_invite_token text,          -- pour MOE sans compte
  affaire text NOT NULL,
  ville text,
  numero_marche text,
  date_debut date,
  date_fin_prevue date,
  remarques text,
  statut text DEFAULT 'en_cours', -- 'en_cours'|'termine'|'archive'
  created_at timestamptz DEFAULT now()
)

-- Familles de fournitures (prédéfinies + custom)
familles_fournitures (
  id uuid PK DEFAULT gen_random_uuid(),
  nom text NOT NULL,              -- 'Végétaux', 'Substrats', etc.
  icone text,                     -- emoji ou code icône
  couleur text,                   -- couleur hex
  ordre int,
  est_systeme bool DEFAULT false  -- familles prédéfinies non supprimables
)
-- Familles prédéfinies paysage:
-- Végétaux 🌿, Substrats 🪨, Semis 🌱, Accessoires plantation 🔧,
-- Mobilier 🪑, Bordures 🔲, Clôtures 🚧, Arrosage 💧, Autres 📦

-- Fournitures d'un chantier
fournitures (
  id uuid PK DEFAULT gen_random_uuid(),
  chantier_id uuid FK→chantiers.id,
  famille_id uuid FK→familles_fournitures.id,
  numero_poste text,  -- numéro de poste dans le devis (ex: "2.3.1")
  designation text NOT NULL,
  description text,   -- caractéristiques détaillées
  reference text,     -- référence fabricant
  unite text DEFAULT 'U',
  qte numeric,
  prix_etude_ht numeric,
  ordre int,
  is_variante bool DEFAULT false,
  parent_id uuid FK→fournitures.id,  -- pour variantes
  created_at timestamptz DEFAULT now()
)
```

### 3.3 Consultations fournisseurs

```sql
-- Consultations (une par chantier + famille ou groupée)
consultations (
  id uuid PK DEFAULT gen_random_uuid(),
  chantier_id uuid FK→chantiers.id,
  entrepreneur_id uuid FK→compte_entrepreneur.id,
  titre text,
  date_envoi timestamptz,
  date_limite_reponse date,
  remarques text,
  statut text DEFAULT 'brouillon',  -- 'brouillon'|'envoyee'|'repondue'|'cloturee'
  created_at timestamptz DEFAULT now()
)

-- Fournisseurs invités à une consultation
consultation_fournisseurs (
  consultation_id uuid FK→consultations.id,
  fournisseur_id uuid FK→fournisseurs.id,
  ordre int,
  PRIMARY KEY (consultation_id, fournisseur_id)
)

-- Invitations (token pour accès invité)
invitations (
  id uuid PK DEFAULT gen_random_uuid(),
  consultation_id uuid FK→consultations.id,
  fournisseur_id uuid FK→fournisseurs.id,
  token text DEFAULT gen_random_uuid()::text,
  expires_at timestamptz DEFAULT now() + interval '30 days',
  created_at timestamptz DEFAULT now(),
  UNIQUE(consultation_id, fournisseur_id)
)

-- Réponses fournisseurs
reponses_fournisseurs (
  id uuid PK DEFAULT gen_random_uuid(),
  consultation_id uuid FK→consultations.id,
  fourniture_id uuid FK→fournitures.id,
  fournisseur_id uuid FK→fournisseurs.id,
  prix_unit_ht numeric,
  commentaire text,
  frais_port numeric,
  delai_livraison text,
  est_variante bool DEFAULT false,   -- variante proposée par fournisseur
  variante_ordre int DEFAULT 0,
  variante_description text,         -- description de la variante
  fiche_technique_url text,          -- lien URL fiche technique
  fiche_technique_storage text,      -- path Supabase Storage
  historique jsonb DEFAULT '[]',
  updated_at timestamptz,            -- null = sauvegardé non envoyé
  created_at timestamptz DEFAULT now(),
  UNIQUE(fourniture_id, fournisseur_id, variante_ordre)
)

-- Catalogue fournisseur
catalogue_fournisseur (
  id uuid PK DEFAULT gen_random_uuid(),
  fournisseur_id uuid FK→fournisseurs.id,
  designation text NOT NULL,
  reference text,
  famille text,
  unite text,
  prix_unit_ht numeric,
  fiche_technique_url text,
  fiche_technique_storage text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(fournisseur_id, designation, reference)
)
```

### 3.4 DAF et VISA

```sql
-- Demandes d'Agrément Fourniture
daf (
  id uuid PK DEFAULT gen_random_uuid(),
  chantier_id uuid FK→chantiers.id,
  fourniture_id uuid FK→fournitures.id,
  fournisseur_id uuid FK→fournisseurs.id,  -- fournisseur retenu
  numero text,        -- ex: "DAF-2024-001" ou numéro de poste "2.3.1-DAF"
  version int DEFAULT 1,
  statut text DEFAULT 'brouillon',
  -- 'brouillon'|'soumise'|'visa_ok'|'visa_remarques'|'refusee'|'commandee'
  designation text,
  description text,
  reference text,
  fabricant text,
  caracteristiques jsonb,  -- champs libres clé/valeur
  fiche_technique_url text,
  fiche_technique_storage text,
  prix_unit_ht numeric,
  qte numeric,
  unite text,
  date_soumission timestamptz,
  date_livraison_prevue date,
  date_commande timestamptz,
  en_stock bool DEFAULT false,
  notes_entrepreneur text,
  parent_daf_id uuid FK→daf.id,  -- pour v2, v3...
  created_at timestamptz DEFAULT now()
)

-- VISA Maître d'Œuvre
visa_moe (
  id uuid PK DEFAULT gen_random_uuid(),
  daf_id uuid FK→daf.id,
  moe_id uuid FK→compte_moe.id,  -- null si invité
  moe_token text,                 -- token si MOE invité
  type text NOT NULL,             -- 'sans_remarque'|'avec_remarques'|'refus'
  remarques text,
  date_visa timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
)
```

### 3.5 DOE et suivi

```sql
-- Tableau de bord suivi par chantier
suivi_fournitures (
  id uuid PK DEFAULT gen_random_uuid(),
  chantier_id uuid FK→chantiers.id,
  fourniture_id uuid FK→fournitures.id,
  daf_id uuid FK→daf.id,
  statut_daf text,          -- miroir de daf.statut
  date_livraison_prevue date,
  date_livraison_reelle date,
  en_stock bool DEFAULT false,
  quantite_recue numeric,
  notes text,
  updated_at timestamptz DEFAULT now()
)

-- Notifications
notifications (
  id uuid PK DEFAULT gen_random_uuid(),
  type text,           -- 'nouvelle_consultation'|'reponse_fournisseur'|
                       -- 'daf_soumise'|'visa_moe'|'commande'
  user_id uuid,        -- destinataire
  message text,
  chantier_id uuid,
  consultation_id uuid,
  daf_id uuid,
  read bool DEFAULT false,
  created_at timestamptz DEFAULT now()
)
```

---

## 4. PORTAIL ENTREPRENEUR

### 4.1 Authentification
- Login / inscription / déconnexion
- Profil : infos légales (SIRET, TVA, adresse, logo)

### 4.2 Tableau de bord
- Liste des chantiers avec statut global
- Notifications (réponses fournisseurs, VISA MOE)
- Accès rapide aux DAF en attente de visa

### 4.3 Onglet Chantier — Paramétrage
- Infos chantier (affaire, ville, numéro marché, dates)
- Associer un MOE (avec compte ou invitation)
- Carnet fournisseurs : recherche + ajout
- Familles de fournitures actives pour ce chantier

### 4.4 Onglet Fournitures
- **Affichage par familles** : une section par famille présente
- Chaque section = cadre coloré avec l'icône de la famille
- Import devis (Excel/PDF/CSV) + parsing IA pour détecter familles
- Saisie manuelle avec sélection famille
- Tableau par famille : n°poste, désignation, qté, unité, prix étude
- Variantes consultant (bouton ＋var)
- Import intelligent :
  1. L'IA analyse le document
  2. Propose le regroupement par famille
  3. L'entrepreneur valide / ajuste
  4. Les n° de poste sont conservés

### 4.5 Onglet Consultation
- Sélectionner les fournitures à consulter (par famille ou tout)
- Sélectionner les fournisseurs
- Envoi au portail fournisseur (avec compte → notification directe)
- Envoi par lien (invité → email Outlook avec token)
- Suivi des réponses reçues

### 4.6 Onglet Comparatif
- Tableau par famille de fournitures
- Colonnes : désignation | étude | fournisseur 1 | fournisseur 2 | ... | retenu | total
- Prix fournisseurs chargés automatiquement depuis reponses_fournisseurs
- Variantes fournisseur en lignes séparées (fond orange)
- Fiches techniques accessibles depuis le tableau (icône 📄)
- Sélection fournisseur retenu par clic
- Saisie manuelle possible
- Frais de port par fournisseur
- Totaux par famille + total général

### 4.7 Onglet DAF
- Liste des DAF par numéro de poste
- Statut visuel : brouillon / soumise / visa OK / remarques / refusée / commandée
- Créer une DAF depuis une fourniture :
  - Numéro auto (basé sur n° de poste du devis)
  - Désignation, référence, fabricant
  - Caractéristiques (champs libres clé/valeur)
  - Fiche technique : upload PDF ou lien URL
  - Fournisseur retenu (depuis comparatif)
  - Prix HT, quantité, unité
- Soumettre au MOE → change statut + notification MOE
- Si refus MOE → créer v2 (ligne ajoutée sous la v1)
- Générer PDF de la DAF

### 4.8 Onglet Suivi
- Tableau récapitulatif toutes fournitures :
  | N°Poste | Désignation | Famille | Statut DAF | VISA | Commandé | Livraison prévue | En stock |
- Filtres par famille, statut
- Colonnes éditables par l'entrepreneur
- Visible aussi par le MOE (lecture seule pour certains champs)

### 4.9 Onglet DOE

**Structure du DOE généré :**
- Page de garde : infos chantier, entrepreneur, MOE, maître d'ouvrage, date
- Sommaire automatique par famille de fournitures
- Une fiche par fourniture validée (DAF visa_ok ou visa_remarques)

**Contenu de chaque fiche fourniture :**
- Numéro de poste + numéro DAF
- Désignation, référence, fabricant, fournisseur retenu
- Caractéristiques techniques (depuis DAF)
- Fiche technique (PDF intégré ou lien)
- Prix HT unitaire + quantité + total
- Date de commande + date de livraison réelle
- Quantité réellement posée

**Deux niveaux de formalisme :**

| Champ | Privé | Public |
|-------|-------|--------|
| Fiche technique | ✅ obligatoire | ✅ obligatoire |
| Référence + fabricant | ✅ | ✅ |
| Garantie (durée) | ✅ | ✅ |
| Guide entretien | ⚪ si disponible | ✅ obligatoire |
| Certificat CE/NF | ⚪ si disponible | ✅ obligatoire |
| PV d'essais | ❌ | ✅ si requis par CCTP |
| Attestation conformité CCTP | ❌ | ✅ |
| Date de pose réelle | ⚪ | ✅ |
| Quantité réellement posée | ✅ | ✅ |
| Sous-traitant si applicable | ❌ | ✅ |

**Boîte de dialogue "Compléter le DOE" :**
- Déclenchée avant la génération PDF
- L'entrepreneur choisit d'abord le niveau : **Privé** ou **Public**
- Affiche uniquement les champs manquants selon le niveau choisi
- Chaque champ manquant indique qui doit le fournir (entrepreneur / fournisseur)
- Possibilité de relancer le fournisseur par email depuis la boîte de dialogue
- Les champs non obligatoires peuvent être ignorés avec mention "non disponible"

**Export :**
- PDF complet du DOE
- Export ZIP avec le PDF + toutes les fiches techniques attachées
- Possibilité d'exporter par famille uniquement

---

## 5. PORTAIL FOURNISSEUR

### 5.1 Authentification
- Avec compte : login email/password
- Invité : seulement le token (nom récupéré depuis fournisseurs)
- URL nettoyée après connexion

### 5.2 Dashboard
- Liste des consultations reçues
- Badge 🔔 sur consultations non répondues
- Rechargement à chaque visite de l'onglet

### 5.3 Onglet Saisie des prix
- Tableau par famille de fournitures (même organisation que côté entrepreneur)
- Pour chaque ligne : prix HT, délai livraison, commentaire, fiche technique (URL ou upload)
- Bouton ＋var : ajouter variante fournisseur
  - Champs éditables : désignation, référence, calibre/contenant, qté
  - parentId = id de la fourniture racine
- Pré-remplissage depuis catalogue avec règles strictes
- Bouton 💾 Sauvegarder (compte seulement, updated_at=null)
- Bouton ✅ Valider & envoyer (updated_at=now() + notification entrepreneur)
- Prix verrouillés après envoi (lecture seule)
- Confirmation si changement d'onglet avec saisies non sauvegardées
- Remise globale % ou par ligne (appliquée au prix catalogue)

### 5.4 Onglet Catalogue
- Liste des fournitures avec prix de référence
- Import CSV
- Fiches techniques associées (URL ou PDF)
- Pré-remplissage automatique des nouvelles consultations

### 5.5 Onglet Historique
- Historique des prix envoyés par consultation et par chantier

### 5.6 Onglet Mon profil
- Infos entreprise, contact, préférences notifications
- Familles de produits proposées (filtre affichage)

---

## 6. PORTAIL MAÎTRE D'ŒUVRE

### 6.1 Authentification
- Avec compte : login email/password (accès à tous les chantiers assignés)
- Invité : token par chantier (envoyé par l'entrepreneur)

### 6.2 Dashboard
- Liste des chantiers avec DAF en attente de VISA
- Badge sur les DAF soumises non traitées
- Historique des VISA donnés

### 6.3 Onglet Fournitures (lecture seule)
- Vue du tableau des fournitures par famille
- Accès aux fiches techniques

### 6.4 Onglet DAF — VISA
- Liste des DAF soumises par n° de poste
- Pour chaque DAF :
  - Affichage complet (désignation, ref, fabricant, caractéristiques, fiche technique)
  - Historique des versions (v1, v2...)
  - Boutons VISA :
    - ✅ **Sans remarque** → DAF validée
    - 📝 **Avec remarques** → champ texte requis → entrepreneur notifié
    - ❌ **Refus** → champ texte requis → entrepreneur crée v2
- Filtres : en attente / validées / refusées

### 6.5 Onglet Suivi (lecture seule + annotations)
- Même tableau que côté entrepreneur
- MOE peut voir statuts en temps réel
- Annotations possibles

---

## 7. RÈGLES MÉTIER

### 7.1 Familles de fournitures (30 familles, tous corps d'état)

Affichage dynamique : seules les familles présentes dans le devis importé sont affichées. L'entrepreneur peut en ajouter manuellement.

| Code | Famille | Icône |
|------|---------|-------|
| VEG | Végétaux | 🌿 |
| SUB | Substrats | 🪨 |
| SEM | Semis & gazons | 🌱 |
| ACC | Accessoires plantation | 🔧 |
| ARR | Arrosage | 💧 |
| MOB | Mobilier urbain | 🪑 |
| BOR | Bordures & délimitations | 🔲 |
| CLO | Clôtures & portails | 🚧 |
| MIN | Minéraux décoratifs | 🏔️ |
| REV | Revêtements sols | 🛣️ |
| RES | Réseaux enterrés | 🕳️ |
| ECL | Éclairage extérieur | 💡 |
| ELE | Réseaux électriques | 🔌 |
| BAS | Bassins & fontainerie | 🌊 |
| MAC | Maçonnerie | 🧱 |
| CHA | Charpente & ossature | ⚙️ |
| COU | Couverture & étanchéité | 🏠 |
| MEX | Menuiseries extérieures | 🚪 |
| MIN2 | Menuiseries intérieures | 🪟 |
| PLO | Plomberie & chauffage | 🔥 |
| ELI | Électricité intérieure | ⚡ |
| PEI | Peinture & revêtements int. | 🎨 |
| VEN | Ventilation & climatisation | ❄️ |
| FER | Ferraillage & coffrages | 🏗️ |
| PAR | Équipements parking | 🚗 |
| PMR | Accessibilité PMR | ♿ |
| JEU | Jeux & loisirs | 🎪 |
| SEC | Sécurité & contrôle accès | 🔒 |
| CF | Courants faibles | 📡 |
| AUT | Autres fournitures | 📦 |

### 7.2 Variantes
- **Variante entrepreneur** : is_variante=true, parent_id=id parent, côté fournitures
- **Variante fournisseur** : est_variante=true, variante_ordre>0, côté reponses_fournisseurs
- Dans le comparatif : variante fournisseur = ligne orange sous la ligne principale

### 7.3 DAF versioning
- v1 créée par entrepreneur → soumise au MOE
- MOE refuse → entrepreneur crée v2 (parent_daf_id=v1.id)
- v2 affichée en ligne indentée sous v1 dans le tableau DAF
- Seul l'entrepreneur peut créer une nouvelle version
- Numérotation : `{n°poste}-{code_chantier}-{code_famille}-{mot_clé}-v{version}`
  - **n°poste** : numéro de poste du devis (ex: `2.3.1`)
  - **code_chantier** : code court du chantier (ex: `CH001`, ou initiales affaire)
  - **code_famille** : code famille sur 3 lettres (ex: `VEG`, `ARR`, `REV`)
  - **mot_clé** : mot clé de la désignation en majuscules, max 8 car. (ex: `QUERCUS`, `GOUTTE`)
  - **version** : `v1`, `v2`... (incrémenté à chaque nouveau cycle de validation)
  - Exemples :
    - `2.3.1-CH001-VEG-QUERCUS-v1` → première soumission
    - `2.3.1-CH001-VEG-QUERCUS-v2` → après refus MOE
    - `4.1.2-CH001-ARR-GOUTTE-v1`
  - Le mot_clé est proposé automatiquement par l'IA depuis la désignation, modifiable par l'entrepreneur

### 7.4 VISA MOE
- Sans remarque → statut DAF = 'visa_ok' → peut être commandée
- Avec remarques → statut DAF = 'visa_remarques' → entrepreneur peut quand même commander
- Refus → statut DAF = 'refusee' → entrepreneur doit créer v2

### 7.5 Pré-remplissage fournisseur
- Genre + espèce + calibre + contenant identiques → "exact" ✅
- Genre + espèce + cultivar différent + calibre/contenant identiques → "cultivar" ✅
- Espèce différente OU calibre/contenant différent → ❌ pas proposé

### 7.6 Tokens d'invitation

**Validité configurable par l'entrepreneur à l'envoi :**
| Option | Validité | Cas d'usage |
|--------|----------|-------------|
| Court | 15 jours | Consultation urgente |
| Standard | 60 jours | Consultation normale (défaut) |
| Long | 6 mois | Consultation de marché |
| Illimité | Pas d'expiration | Fournisseur récurrent de confiance |

**Règles :**
- Un token par (consultation, fournisseur)
- Un token par (chantier, MOE invité)
- Accès invité : seulement le token, nom récupéré depuis la base
- Token expiré → message clair "lien expiré, contactez le consultant"
- Les prix saisis restent en base même après expiration du token
- Bouton **"Renouveler le lien"** dans l'onglet Envoi : génère un nouveau token sans effacer les prix existants
- Le renouvellement envoie automatiquement un nouvel email au fournisseur

### 7.7 DOE
- Compilé depuis toutes les DAF avec statut 'visa_ok' ou 'visa_remarques'
- Organisé par famille de fournitures
- Chaque entrée : n°poste, désignation, référence, fabricant, fiche technique, prix HT, fournisseur, date commande
- Boîte de dialogue pour infos manquantes (fiche technique absente, référence manquante)
- Export PDF final

---

## 8. RLS SUPABASE

**Principe fondamental : RLS active sur toutes les tables, sans jointures.**

Pour éviter les récursions infinies, chaque table fille contient une colonne `entrepreneur_id` (ou `fournisseur_id` / `moe_id`) dénormalisée. La policy RLS est toujours un simple `WHERE X_id = auth.uid()` sans sous-requête.

### 8.1 Colonnes dénormalisées à ajouter

Chaque table fille doit contenir les colonnes d'accès direct nécessaires :

| Table | Colonnes dénormalisées |
|-------|----------------------|
| `chantiers` | `entrepreneur_id` |
| `fournitures` | `entrepreneur_id`, `chantier_id` |
| `consultations` | `entrepreneur_id` |
| `consultation_fournisseurs` | `entrepreneur_id` |
| `invitations` | `entrepreneur_id`, `fournisseur_id` |
| `reponses_fournisseurs` | `fournisseur_id`, `entrepreneur_id` |
| `catalogue_fournisseur` | `fournisseur_id` |
| `daf` | `entrepreneur_id`, `fournisseur_id` |
| `visa_moe` | `moe_id`, `entrepreneur_id` |
| `suivi_fournitures` | `entrepreneur_id` |
| `notifications` | `user_id` (déjà présent) |

### 8.2 Policies RLS

```sql
-- Comptes (lecture/écriture propre uniquement)
compte_entrepreneur : ALL USING (id = auth.uid())
compte_fournisseur  : ALL USING (id = auth.uid())
compte_moe          : ALL USING (id = auth.uid())

-- Chantiers (entrepreneur propriétaire)
chantiers : ALL USING (entrepreneur_id = auth.uid())

-- Fournitures (entrepreneur propriétaire + MOE lecture)
fournitures :
  SELECT USING (entrepreneur_id = auth.uid() OR moe_id_chantier = auth.uid())
  INSERT/UPDATE/DELETE USING (entrepreneur_id = auth.uid())

-- Consultations (entrepreneur propriétaire)
consultations : ALL USING (entrepreneur_id = auth.uid())

-- Invitations (entrepreneur crée, fournisseur lit la sienne)
invitations :
  SELECT USING (entrepreneur_id = auth.uid() OR fournisseur_id IN (
    SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
  ))
  INSERT/UPDATE/DELETE USING (entrepreneur_id = auth.uid())

-- Réponses fournisseurs
reponses_fournisseurs :
  SELECT USING (entrepreneur_id = auth.uid() OR fournisseur_id IN (
    SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
  ))
  INSERT/UPDATE USING (fournisseur_id IN (
    SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
  ))

-- Catalogue fournisseur
catalogue_fournisseur : ALL USING (fournisseur_id IN (
  SELECT fournisseur_id FROM compte_fournisseur WHERE id = auth.uid()
))

-- DAF (entrepreneur crée, MOE lit et visa)
daf :
  SELECT USING (entrepreneur_id = auth.uid() OR moe_id = auth.uid())
  INSERT/UPDATE USING (entrepreneur_id = auth.uid())

-- VISA MOE
visa_moe :
  SELECT USING (entrepreneur_id = auth.uid() OR moe_id = auth.uid())
  INSERT USING (moe_id = auth.uid())

-- Notifications
notifications : ALL USING (user_id = auth.uid())
```

### 8.3 Fonctions SECURITY DEFINER (accès par token sans auth)

Pour les utilisateurs invités (sans compte) qui accèdent via token :

```sql
-- Fournisseur invité : lire la consultation via token
get_consultation_by_token(p_token text) → SETOF consultations
  SECURITY DEFINER — contourne RLS, vérifie le token en interne

-- Fournisseur invité : lire les fournitures via token
get_fournitures_by_token(p_token text) → SETOF fournitures
  SECURITY DEFINER

-- MOE invité : lire les DAF d'un chantier via token
get_daf_by_moe_token(p_token text) → SETOF daf
  SECURITY DEFINER

-- Fournisseur invité : écrire ses réponses via token
upsert_reponse_by_token(p_token text, p_data jsonb) → reponses_fournisseurs
  SECURITY DEFINER — vérifie token valide avant écriture
```

### 8.4 Règle de sécurité absolue
- RLS active sur **toutes** les tables sans exception
- Jamais de jointure dans une policy RLS (cause récursion infinie)
- Toujours dénormaliser `entrepreneur_id` plutôt que de remonter via jointure
- Les invités (sans compte) passent exclusivement par les fonctions SECURITY DEFINER

---

## 9. FONCTIONS SQL (SECURITY DEFINER)

```sql
-- Lire un chantier via token MOE invité
get_chantier_by_moe_token(p_token text) → SETOF chantiers

-- Lire une consultation via token fournisseur invité
get_consultation_by_token(p_token text) → SETOF consultations

-- Lire les fournitures d'une consultation via token
get_fournitures_by_token(p_token text) → SETOF fournitures
```

---

## 10. FONCTIONNALITÉS V2 (POST-LANCEMENT)

- Autocomplétion botanique (GBIF / Tela Botanica)
- Fournisseurs favoris triés par fréquence
- Planning de livraison (Gantt simplifié)
- Export XLSX du comparatif
- Multi-langues complet (FR/ES/EN)
- Application mobile (PWA)
- Signature électronique des DAF
- Connexion ERP entrepreneur

---

## 11. POINTS D'ATTENTION POUR LA RECONSTRUCTION

1. **Apostrophes françaises** : systématiquement échapper dans les strings JS (`d\\'accès`)
2. **Supabase v2** : pas de `.catch()`, utiliser `try/catch` partout
3. **`.single()` → `.maybeSingle()`** : quand le résultat peut être vide
4. **RLS et récursions** : désactiver RLS sur les tables filles, sécuriser via fonctions SECURITY DEFINER
5. **Variantes** : toujours stocker parentId vers la racine non-variante
6. **Validation JS** : `node --check fichier.js` avant chaque livraison
7. **Tokens** : nettoyer l'URL après connexion, ne pas redemander le nom si token valide
8. **Portail fournisseur** : distinguer `is_variant` (variante entrepreneur) de `est_variante` (variante fournisseur)

---

## 12. NOTIFICATIONS & RÉCAPITULATIFS EMAIL

### 12.1 Notifications immédiates (temps réel)
| Événement | Destinataire |
|-----------|-------------|
| Nouvelle consultation reçue | Fournisseur |
| Réponse fournisseur reçue | Entrepreneur |
| DAF soumise | MOE |
| VISA MOE rendu | Entrepreneur |
| DAF refusée | Entrepreneur |
| Commande confirmée | Fournisseur |

### 12.2 Récapitulatifs périodiques
Chaque utilisateur choisit sa préférence dans son profil :
- **Immédiat** : email à chaque événement
- **Quotidien** : récap chaque jour à 8h si activité dans les 24h
- **Hebdomadaire** : récap chaque lundi matin si activité dans la semaine
- **Aucun** : pas d'email (notifications portail uniquement)

### 12.3 Contenu des récapitulatifs

**Entrepreneur :**
- Nouvelles réponses fournisseurs reçues (N réponses sur X consultations)
- VISA MOE rendus (OK / avec remarques / refus)
- DAF en attente de réponse depuis plus de 7 jours
- Livraisons prévues dans les 7 prochains jours

**Fournisseur :**
- Nouvelles consultations reçues
- Rappel consultations sans réponse (J-3 avant date limite)
- Commandes confirmées

**MOE :**
- DAF en attente de VISA (avec ancienneté)
- Nouvelles DAF soumises depuis dernier récap

### 12.4 Implémentation technique
- Edge Function Supabase `send-recap` déclenchée par cron
- Cron quotidien : 8h00 UTC
- Cron hebdomadaire : lundi 8h00 UTC
- Template HTML email par acteur et par langue (FR/EN/ES)
- Lien de désinscription dans chaque email
- Envoi via Resend
