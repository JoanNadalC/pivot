# Spécification — Page de garde DOE (Dossier des Ouvrages Exécutés)

Composant de **page de couverture A4 portrait** pour les DOE générés par Pivot · La Racine.
À implémenter en HTML/CSS print-ready (une page = 210 × 297 mm). Trois variantes de mise en page au choix, partageant la même charte et les mêmes données.

---

## 1. Charte graphique (à respecter strictement)

Reprend le style du portail Pivot · La Racine.

### Couleurs
| Token | Hex | Usage |
|---|---|---|
| `--vert` | `#1C3A2A` | Fond foncé, texte principal sur clair |
| `--vert-md` | `#2D5940` | Texte secondaire vert |
| `--vert-lt` | `#3E7A58` | Lueurs, puces de statut |
| `--ecru` | `#F5F0E8` | Texte sur fond foncé |
| `--blanc` | `#FAFAF7` | Fond clair de page |
| `--cuivre` | `#B87333` | Accent (eyebrows, lots, filets, puces) |
| `--gris` | `#6B7280` | Labels, légendes |
| `--gris-lt` | `#E8E4DC` | Filets / séparateurs fins |

### Typographie (Google Fonts)
- **Titres / logo / chiffres marquants** : `Playfair Display` (700 / 900, italique pour les accents).
- **Texte courant / labels** : `Inter` (400 / 500 / 600).
- Labels en `text-transform: uppercase`, `letter-spacing: 0.1–0.2em`, taille 10–12 px, couleur cuivre (sur foncé) ou gris (sur clair).

### Détails de style récurrents
- Logo : `Pivot` + point cuivre + `La Racine` en italique grisé.
- Bordures et filets fins : `0.5px` (jamais 1px lourd).
- Rayons d'angle : 0 (page) à 4 px max.
- Fond foncé décoré d'une **trame** (grille 36 px, lignes à `rgba(245,240,232,0.04)`) et de **lueurs radiales** vertes/cuivre.
- Eyebrow systématique : `Dossier des Ouvrages Exécutés` en majuscules cuivre.
- Emplacement logo entreprise : encadré `0.5px`, fond légèrement contrasté ou hachuré, label « logo entreprise » tant qu'aucun fichier n'est fourni.

---

## 2. Données à injecter

```jsonc
{
  "titreDocument": "Dossier des Ouvrages Exécutés", // fixe
  "nomChantier":   "Groupe Scolaire Jean Jaurès",
  "natureTravaux": "Réhabilitation & extension",     // optionnel, affiché avec la ville
  "ville":         "Villeurbanne (69)",
  "lot": {                                            // OPTIONNEL — masquer le bloc si absent
    "numero": "04",
    "nom":    "Menuiseries Extérieures"
  },
  "moa":           "Ville de Villeurbanne — Dir. des Bâtiments", // Maître d'ouvrage
  "moe":           "Atelier d'Architecture Vallée & Associés",   // Maître d'œuvre
  "entreprise": {                                     // entreprise réalisatrice
    "nom":  "Bâti-Rhône Construction",
    "logo": null                                      // URL/blob du logo, sinon placeholder
  },
  "numeroChantier": "CH-2024-087",
  "date":           "Juin 2026",        // date d'émission
  "version":        "2.0 · Indice B"    // version + indice
}
```

### Règles d'affichage
- **Ligne de lot** : affichée **sous la ville**, format `Lot {numero}` (Playfair italique cuivre) + séparateur fin + `{nom}`. **Ne pas afficher** ce bloc si `lot` est vide (DOE global non découpé en lots).
- **Logo Pivot** : toujours en en-tête.
- **Logo entreprise** : si `entreprise.logo` fourni → l'afficher dans l'encadré ; sinon placeholder « logo entreprise ».
- Tous les champs de métadonnées (MOA, MOE, entreprise, n° chantier, date, version) sont obligatoires sur la garde.

---

## 3. Variantes de mise en page

Trois templates sélectionnables. Tous : page A4 portrait, marges ~64–72 px.

### Variante A — « Couverture pleine » (impact)
- Fond **vert** plein avec trame + lueurs.
- En-tête : logo Pivot (gauche) / encadré logo entreprise (droite).
- Bloc central vertical-centré : eyebrow cuivre en pastille → titre chantier en gros Playfair 900 (accent du nom en italique cuivre) → ville → ligne de lot.
- Bas de page : grille **3 colonnes** de métadonnées (MOA, MOE, Entreprise, N° chantier, Date, Version), labels cuivre / valeurs écru, séparée par un filet.
- Pied : `© 2026 Pivot La Racine` + mention « Document contractuel ».

### Variante B — « Rapport sobre » (institutionnel)
- Fond **écru clair**, texte vert.
- En-tête : logo Pivot (gauche) / n° chantier + encadré logo entreprise (droite).
- Filet cuivre court → eyebrow cuivre → titre chantier Playfair → ville → ligne de lot.
- Bas : **tableau de définitions** (lignes label/valeur séparées par filets `0.5px`) : MOA, MOE, Entreprise, Localisation, Date, Version.
- Pied : puce verte + mention « Document généré via Pivot La Racine ».

### Variante C — « Bandeau & fiche » (chantier)
- **Bandeau vert** en tête (~40 % hauteur) avec trame + lueur : logo Pivot / logo entreprise, eyebrow, titre, ville, lot.
- **Filet cuivre 4 px** de séparation.
- Zone claire : **emplacement photo de l'ouvrage** (placeholder hachuré, label monospace), puis bloc « Entreprise réalisatrice » (nom Playfair + logo), puis **grille 2 colonnes** de métadonnées avec accents cuivre à gauche (MOA, MOE, N° chantier, Date · Version).
- Pied : `© 2026 Pivot La Racine` + « Document contractuel ».

---

## 4. Contraintes techniques

- **Format d'impression** : `@page { size: A4; margin: 0; }`, page = `794 × 1123 px` à 96 dpi (ou `210mm × 297mm`).
- HTML statique, styles **inline ou CSS simple** — aucune dépendance JS pour le rendu.
- Polices via Google Fonts (`Playfair Display`, `Inter`) ; prévoir un fallback `serif` / `sans-serif`.
- Le logo entreprise doit accepter une image (PNG/SVG) **ou** rester en placeholder.
- Texte adaptable : les titres longs doivent rester lisibles (`text-wrap: pretty`, line-height ~1.1).
- Couleurs et tokens ci-dessus à centraliser en variables CSS (`:root`).

---

## 5. Référence

L'implémentation de référence des trois variantes existe en HTML : `Page de garde DOE.dc.html`. S'y reporter pour les valeurs exactes (tailles, marges, espacements).
