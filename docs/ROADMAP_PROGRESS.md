# ROADMAP N7 — Suivi de chantier Jarvis

> Dernière mise à jour : **29 mai 2026** — Constitution gravée (`DOCS/MASTER_PRD.md`)

---

## Phase A — Fondations de conscience

| Étape | Statut | Notes |
|-------|--------|-------|
| Moteur Living Intelligence (3 agents parallèles) | ✅ | `living-deliberation.engine.ts` |
| LIVING_BUILDING_STATE v6/v7 | ✅ | 10 variables maîtresses |
| Tabula Rasa — 3 phrases + bibliothèque brute | ✅ | `living-tabula-rasa.ts`, `living-tabula-savoir.ts` |
| Démantèlement rails V1 (perceptionBrief, triple flux forcé, reconcile trade) | ✅ | Merge allégé, factory neutre DAWN |
| Suppression extraction 360° imposée (plomberie/élec/menuiserie) | ✅ | `applyJarvisLanguageToState` |
| Constitution produit MASTER_PRD | ✅ | Ce dépôt |
| NuclearFlush — armoire vidée à chaque session/tour | ✅ | `nuclearFlushLivingState()` |
| Discipline `.cursorrules` + règles Cursor | ✅ | Loi Suprême gravée |

---

## Phase B — Gardien de sécurité

| Étape | Statut | Notes |
|-------|--------|-------|
| Module Gardien dédié (hors merge métier) | ⬜ | Agent ou couche post-délibération |
| Verrou ZENITH sans scripts de parole imposés | ⬜ | Gardien parle via Majordome + faits |
| Confirmation locataire → `safetyVerified` | 🟡 | Module `living-building-state.safety.ts` existant |
| Lia-Lab — visualisation verrou temps réel | ⬜ | Dashboard sécurité |

---

## Phase C — Système de Capture de Sagesse (Le Stylo)

| Étape | Statut | Notes |
|-------|--------|-------|
| Répertoire `knowledge/doctrine/` | ✅ | Stylo des agents |
| API écriture leçons (`living-doctrine-stylo.ts`) | ✅ | Append après délibération |
| Injection doctrine dans bibliothèque agents | 🟡 | Chargement lessons en lecture |
| Workflow validation Architecte | ⬜ | Revue humaine avant promotion |
| Groq — champ `doctrineLesson` dans rapports experts | 🟡 | Branché merge → Stylo |

---

## Phase D — Dashboards synchronisés

| Étape | Statut | Notes |
|-------|--------|-------|
| Rapport mission chirurgical (Tech) | ⬜ | Export depuis `intervention` |
| Bouclier responsabilité (Bailleur) | ⬜ | Export depuis `legalVerdict` |
| Carnet santé dynamique (Direction) | ⬜ | Agrégation multi-tickets |
| Lia-Lab symétrie + instruments | 🟡 | Sections existantes à aligner N7 |
| Sync temps réel LIVING_BUILDING_STATE | 🟡 | Repository ticket |

---

## Légende

- ✅ Terminé
- 🟡 Partiel / en cours
- ⬜ À faire

---

## Prochaine action recommandée

**Phase B** : extraire le Gardien de sécurité en couche souveraine post-délibération, sans réintroduire de scripts linéaires dans les prompts agents.
