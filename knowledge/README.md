# Knowledge — bibliothèque métier LE LOCATAIRE

Ce dossier alimente **Lia Researcher** (bibliothécaire) : il ne « devine » pas, il **ouvre la bonne page du bon cours** avant que le pathologiste et le juriste concluent.

Références projet : `NOTE.md` §4ter (Organisateur → Recherche → Diagnostic), `MANIFESTE_FINAL.md`, `.cursor/rules/metier.mdc`.

---

## 1. Corpora de référence (recherche web — mai 2026)

### AFPOLS (souvent abrégé « AFPOL »)

**Nom officiel** : [AFPOLS](https://www.afpols.fr/qui-sommes-nous) — *Association pour la Formation Professionnelle continue des Organismes de Logement Social*.

Organisme de référence du **logement social** (~300 formations). Parcours **Pathologies et désordres des bâtiments** :

| Code | Formation | Intérêt pour Lia |
|------|-----------|------------------|
| **C0233** | [Diagnostics et pathologies du bâtiment](https://www.afpols.fr/formations-inter-entreprises/nos-formations/patrimoine/pathologies-et-desordres-des-batiments/diagnostics-et-pathologies-du-batiment) (42 h) | Méthode expert : prévenir → analyser → diagnostiquer → informer le locataire |
| **C0237** | L'eau et ses pathologies (condensations, infiltrations) | **80 % des sinistres** liés à l'eau — différencier les causes |
| **C0235** | Gros œuvre / clos couvert | Fissures, structure, toiture |
| **C0236** | Second œuvre / équipements | Électricité NF C 15-100, plomberie, VMC |
| **C0411** | [Tout comprendre sur les pathologies](https://www.afpols.fr/formations-inter-entreprises/nos-formations/patrimoine/pathologies-et-desordres-des-batiments/tout-comprendre-sur-les-pathologies-du-batiment) | Parcours complet gros + second œuvre |

**Usage Lia** : vocabulaire commun avec les **référents secteur** formés AFPOLS ; alignement des questions intake sur les modules (eau, façade, équipements).

### AQC — Agence Qualité Construction

Site : [qualiteconstruction.com](https://qualiteconstruction.com/agence-qualite-construction/consolider-bonnes-pratiques-construction-renovation/)

| Ressource | Contenu | Intérêt Guyane / humidité |
|-----------|---------|---------------------------|
| **Fiches pathologie bâtiment** (6e éd. 2024, ~86 fiches) | Constat → diagnostic → bonnes pratiques + textes | Index `pathology-index.json` |
| Fiche [Remontées capillaires](https://qualiteconstruction.com/ressource/fiches-pathologie-batiment/remontees-capillaires/) | Franges, salpêtre, décollement | Charge bailleur typique |
| Fiche [Humidité sous-sol](https://qualiteconstruction.com/ressource/fiches-pathologie-batiment/humidite-sous-sol-batiments/) | DROM, pluies, drainage | **Pertinent Guyane** |
| [REX Humidité bâtiments performants](https://qualiteconstruction.com/wp-content/uploads/2024/05/Rapport-REX-BP-Humidite-Construction-AQC.pdf) | 4 sources d'humidité, diagnostic initial | Séquence recherche avant verdict |

**Complément pédagogique** (hors AQC, même méthode) : MOOC Cerema/CSTB [Bâti existant et humidité](https://www.mooc-batiment-durable.fr/fr/formations/bati-existant-et-humidite-diagnostic-avant-rehabilitation/).

---

## 2. Lia Researcher = bibliothécaire

```
Signalement locataire + intake + photo
        │
        ▼
┌───────────────────┐
│  Lia Researcher   │  ← lit pathology-index.json + legal-references + tickets similaires
│  (bibliothécaire) │
└─────────┬─────────┘
          │ KnowledgeRef[] + brief interne
          ▼
┌───────────────────┐     ┌─────────────┐
│   Pathologiste    │ ──► │   Juriste   │
└───────────────────┘     └─────────────┘
```

**Règle** : la recherche **ne tranche pas** seule ; elle **cite** la fiche/cours et enrichit `DiagnosticState`.

Implémentation : `LiaResearchService` + `knowledge-index.loader.ts` + `lia-diagnostic-state.ts`.

---

## 3. Logique différentielle (méthode expert)

Inspirée des formations AFPOLS (*« prévenir, analyser, comprendre la nature d'un désordre »*) et des fiches AQC (*constat → diagnostic*).

### Étape A — Signes cliniques (pas seulement « il y a de l'humidité »)

| Canal | Exemples | Source |
|-------|----------|--------|
| **Couleur** | franges sombres, salpêtre blanc, moisissure noire en coin | texte locataire, photo IA |
| **Texture** | enduit qui cloque, efflorescence, mur froid | texte, photo |
| **Odeur** | moisi, renfermé après pluie | texte locataire (souvent oublié — Lia peut demander) |
| **Motif / pattern** | monte depuis le sol, grossit quand il pleut | intake organisateur |
| **Localisation** | plinthes, plafond, SDB, façade | intake |

Ces signes alimentent `DiagnosticState.clinicalSigns[]`.

### Étape B — Hypothèses concurrentes

Pour chaque entrée de `pathology-index.json`, scorer la correspondance signes + mots-clés → `DiagnosticState.hypotheses[]` avec probabilité.

**Élimination** : une réponse intake ou un signe contraire retire une hypothèse (ex. « ça s'aggrave à chaque pluie » → infiltration plutôt que condensation seule).

### Étape C — Hiérarchie (cf. `.cursor/rules/metier.mdc`)

1. **Danger** (électricité, effondrement, incendie)
2. **Historique** bâtiment / tickets similaires
3. **Fiche AQC / module AFPOLS** la plus probable
4. **Photo** si signes flous ou hypothèses proches

### Étape D — Verdict

Le juriste reçoit le brief bibliothécaire + `DiagnosticState.leadingHypothesisId` — jamais une conclusion sans trace.

---

## 4. Fichiers de ce dossier

| Fichier | Rôle |
|---------|------|
| `README.md` | Ce document — méthod, sources AFPOLS/AQC |
| `pathology-index.json` | Index bibliothécaire (cours + fiches + signes cliniques + mots-clés) |

**Savoir interne complémentaire** (hors `/knowledge`) :

- `data/legal-references.json` — juridique locataire/bailleur
- `data/panne-diagnostic-logique.json` — organisateur (questions discriminantes)
- `data/reclamations-locataires.json` — périmètres réclamation

---

## 5. Enrichir l'index (procédure)

1. Identifier une pathologie récurrente sur le terrain Guyane.
2. Lire la fiche AQC correspondante (constat + diagnostic).
3. Ajouter une entrée dans `pathology-index.json` avec `clinicalSigns` et `sources`.
4. Lier à une catégorie Lia (`HUMIDITY`, `PLUMBING`, …).
5. Exécuter les tests : `npx jest src/lia/lia-diagnostic-state.spec.ts`.

**Ne pas copier** le texte intégral des fiches AQC (droits d'auteur) : résumés + URL + ref (ex. `B.01`).

---

## 6. Entrée locataire, 6 mois, GPA

| Règle | Détail |
|-------|--------|
| Comparaison | Toujours par rapport à l’**entrée** et à la **remise en état**, pas l’ancienneté seule |
| **6 mois** | Menues réparations non bien faites à la remise en état → charge **bailleur** |
| **GPA** | Remise en état **neuve** : garantie de parfait achèvement ≈ **1 an** (`HlmResidence.gpaEndDate` en base si lien patrimoine) |
| Code | `lia-occupancy-context.ts`, `lia-housing-warranty.ts`, enrichit `LiaResearchService` |

## 7. État `DiagnosticState` (backend)

Type : `mon-backend/backend/src/lia/lia-diagnostic-state.types.ts`

Persisté dans `ticket.aiLastDecision.diagnostic` avec le SharedState Lia.

Champs clés :

- `clinicalSigns` — odeur, couleur, texture, motif, localisation
- `hypotheses` — hypothèses différentielles + refs AFPOLS/AQC
- `leadingHypothesisId` — piste principale après scoring
- `researchRefs` — pages « ouvertes » par le bibliothécaire
- `missingSignChannels` — ce qu'il faut encore demander (ex. odeur, photo texture)

---

*Dernière mise à jour : 21 mai 2026 — aligné recherche AFPOLS/AQC et humidité Guyane.*
