# MASTER PRD — Jarvis V2 · Niveau 7
## Système de Conscience Patrimoniale

> **Statut** : Constitution produit validée par l'Architecte — mai 2026  
> **Pilote** : 2terHabitat (Guyane) — bilingue FR / GCF

---

## 1. Vision

**LE LOCATAIRE** n'est plus une application de maintenance. C'est un **Système de Conscience Patrimoniale** : une IA **neuro-sim bio-sémantique** bilingue (français + créole guyanais) qui accompagne le locataire, éclaire le technicien, protège le bailleur et nourrit la direction patrimoniale.

Le locataire parle. Une **équipe d'experts simulés** délibère en synchrone sur les faits bruts et la bibliothèque AFPOL/Loi. Le **Gardien de sécurité** est la seule loi dure du produit. Tout le reste émerge de la simulation physique (flux, altimétrie, analogies) — jamais d'arbres `if/else` ni de scripts JSON linéaires.

---

## 2. Architecture — Délibération synchrone

```
Locataire (3 phrases brutes)
        │
        ▼
┌───────────────────────────────────────────────────┐
│  DÉLIBÉRATION SYNCHRONE (Groq, parallèle)         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Enquêteur   │ │ Archiviste  │ │ Majordome   │  │
│  │ 8B · AFPOL  │ │ 8B · Loi    │ │ 70B · Parole│  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘  │
│         └───────────────┼───────────────┘         │
│                         ▼                         │
│              LIVING_BUILDING_STATE                │
└───────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────────────────┐
│ Gardien         │     │ Stylo — knowledge/doctrine/ │
│ Sécurité        │     │ (leçons validées Architecte)│
└─────────────────┘     └─────────────────────────────┘
```

| Agent | Rôle | Entrée autorisée |
|-------|------|------------------|
| **Enquêteur** | Radar physique AFPOL — flux, 3D, métier | 3 phrases + bibliothèque brute |
| **Archiviste** | Encyclopédie légale — charge, articles | 3 phrases + bibliothèque brute |
| **Majordome** | Pilote — parole Marie, créole, empathie | Rapports experts du tour + 3 phrases |
| **Gardien** | Verrou sécurité (électricité, gaz, structure) | Patches agents + confirmation locataire |

**Principe Tabula Rasa** : à chaque tour, l'armoire cognitive est vidée (`NuclearFlush`). Le bâtiment est redécouvert. Changement de sujet → nouvelle session d'état.

**Code source de vérité** : `mon-backend/backend/src/agents/orchestrateur/living-intelligence/`

---

## 3. Source de vérité — LIVING_BUILDING_STATE

Objet unique persisté (Supabase / `jarvisFacts`) — lu en temps réel par locataire, technicien et bailleur.

### Les 10 variables maîtresses

| # | Variable | Champ(s) | Sens |
|---|----------|----------|------|
| 1 | **Ancrage 3D** | `vision3d.floorLevel`, `rooms`, `above`, `below` | Où dans le bâtiment |
| 2 | **Flux** | `vision3d.activeFlows` | Eau, air, chaleur, étanchéité — cinétique |
| 3 | **Symptôme** | `vision3d.symptomAnchor`, `element` | Ce que Marie voit / ressent |
| 4 | **Contrainte humaine** | `humanBarrier`, `tenantProfile` | Âge, vulnérabilité, langue — donnée physique |
| 5 | **Verrou sécurité** | `safetyLock` | Gardien — seule exception aux rails souples |
| 6 | **Verdict technique** | `intervention.tradeNeeded`, `technicianSummary` | Métier, urgence, dispatch |
| 7 | **Verdict légal** | `legalVerdict.chargeHorizon`, `articles`, `facts` | LOCATIF / RÉCUPÉRABLE / PATRIMOINE |
| 8 | **Sévérité** | `safetyLock.severityZone` | DAWN → ZENITH_DANGER |
| 9 | **Logistique** | `intervention.partsToBring`, `toolsRequired` | Mission technicien |
| 10 | **Doctrine** | `savoirConsulted`, `symmetricDeliberation`, `knowledge/doctrine/` | Héritage et leçons apprises |

Schéma : `living-building-state.types.ts` · Factory : `living-building-state.factory.ts`

---

## 4. Livrables finaux (sorties produit)

| Livrable | Public | Contenu |
|----------|--------|---------|
| **Rapport de mission chirurgical** | Technicien secteur | Synthèse technique, métier, pièces, accès, urgence |
| **Bouclier de responsabilité** | Bailleur / AGENT | Verdict charge, articles mobilisés, traçabilité AFPOL |
| **Carnet de santé dynamique** | Direction patrimoniale | Agrégation signes, récurrence, sévérité, tendances bâtiment |
| **Doctrine Jarvis** | Héritage | Leçons capturées par le Stylo dans `knowledge/doctrine/` |

---

## 5. Loi Suprême (développement)

1. **Interdiction** de coder des scripts JSON linéaires ou des arbres de décision pour le dialogue Jarvis.
2. **Obligation** : tout raisonnement issu de la simulation physique (flux, altimétrie, analogies) et de la délibération des agents.
3. **L'humain est une donnée physique de contrainte** — pas un case à cocher.
4. **NuclearFlush actif** à chaque session / tour — zéro fantôme V1.
5. **Conformité** : avant toute modification significative, lire ce document et `DOCS/ROADMAP_PROGRESS.md`.

---

## 6. Stack de production

| Couche | Emplacement |
|--------|-------------|
| Backend Lia (seule vérité) | `mon-backend/backend/` |
| Living Intelligence | `src/agents/orchestrateur/living-intelligence/` |
| Savoir | `knowledge/`, `data/legal-references.json`, `data/panne-diagnostic-logique.json` |
| Doctrine (Stylo) | `knowledge/doctrine/` |
| Référent admin | `admin-dashboard/` |
| Mobile locataire | `mobile/flutter/` |

Ne pas confondre avec `admin-dashboard-old/` ni `mon-backend/dashboard/` (prototypes).

---

## 7. Références complémentaires

- `MANIFESTE_FINAL.md` — architecture Goals / SharedState
- `NOTE.md` — décisions projet et historique
- `VISUAL_LOGIC.md` — Exutoire, Dalle froide, Enveloppe
- `DOCS/ROADMAP_PROGRESS.md` — suivi de chantier N7
