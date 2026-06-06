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
| `LivingGuardianService` — 4 missions sacrées | ✅ | `living-guardian.service.ts` |
| Verdict PASS / RE-DELIBERATE / OVERRIDE | ✅ | Injecté fin `LivingReasoningService` |
| Safety Override — en-tête ZENITH | ✅ | Réécriture autoritaire |
| Veto cohérence Majordome vs Enquêteur | ✅ | Re-délibération |
| Filtre protection sociale | ✅ | Veto effort physique |
| Stylo — PENDING_ADMIN_SIGNATURE | ✅ | `living-doctrine-stylo.ts` |
| Murmures Gardien — console Lia-Lab | ✅ | `guardianConsole` + `guardianMurmures` |
| Signature Architecte cockpit | ✅ | `DoctrineRegistryPage` + API `/doctrine-ledger` |
| Lia-Lab — visualisation verrou temps réel | 🟡 | Safety + Gardien sections |

---

## Phase C — Gouvernance Doctrine (Registre de Sagesse)

| Étape | Statut | Notes |
|-------|--------|-------|
| `JARVIS_DOCTRINE_LEDGER.json` | ✅ | Index structuré PENDING / SIGNED |
| API NestJS list / sign / reject | ✅ | `doctrine-ledger/` |
| Cockpit Admin « Registre de Sagesse » | ✅ | `/admin/doctrine-registry` |
| Injection Loi signée en délibération | ✅ | `loadSignedDoctrineForDeliberation(48)` |
| Prompt Architecte post-délibération Lia-Lab | ✅ | rôle `architect` + lien registre |
| Groq — champ `doctrineLesson` dans rapports experts | 🟡 | Branché merge → Stylo |

---

## Phase C (legacy) — Système de Capture de Sagesse (Le Stylo)

| Étape | Statut | Notes |
|-------|--------|-------|
| Répertoire `knowledge/doctrine/` | ✅ | Stylo des agents |
| API écriture leçons (`living-doctrine-stylo.ts`) | ✅ | Append après délibération |
| Injection doctrine dans bibliothèque agents | ✅ | Leçons SIGNED uniquement |
| Workflow validation Architecte | ✅ | Registre + sceau |
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
