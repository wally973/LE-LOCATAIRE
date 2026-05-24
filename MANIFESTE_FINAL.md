# MANIFESTE FINAL — LE LOCATAIRE

Document d’intention produit / architecture (référence pour Cursor et l’équipe).

## Règle de rectification expert

**Le système doit permettre à un technicien ou référent de surcharger (override) le diagnostic proposé par l’IA.** Cette action met à jour le **ticket partagé** (`aiLastDecision` + champs ticket) et sert de **feedback** pour que Lia ajuste son raisonnement : l’expertise terrain **écrase** la proposition machine ; Lia reste **assistante de la décision du pro**, sans contester la correction.

États cibles :

| Avant | Après rectification |
|--------|---------------------|
| `AI_PROPOSED` | `EXPERT_VALIDATED` |

Champs persistés (JSON `aiLastDecision.expertRectification`) : motif, diagnostic corrigé, nom de l’expert, horodatage, **archive** de la décision IA initiale.

Synthèse affichée : *« Suite à l’expertise terrain de [Nom]… »*.

## Architecture IA (rappel — stack réelle)

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Mobile locataire | **Flutter** | Signalement, fil Lia, photo |
| Backend | **NestJS** + Prisma | `LiaAgentService` (objectifs + **SharedState**), pathologiste, juriste |
| Référent / technicien | **admin-dashboard** | Réclamations, détail affaire, **Pro Briefing**, rectification expert ; **IA sur contextes particuliers** depuis **PC ou tablette** (Q65) |
| Ancien prototype web locataire | `admin-dashboard` hooks `useOrchestratorAI` | Bride front — **pas** le fil production Flutter |

**Ne pas confondre** avec `ticket_manager.py` ou pipelines Python : tout passe par `mon-backend/backend/src/lia/`.

## Boucle de retour expert (implémentée)

1. Technicien lit le **Pro Briefing** et le diagnostic IA.
2. `POST /tickets/:id/expert-rectification` — correction + motif.
3. SharedState enrichi → Q&A Pro Briefing et synthèses s’appuient sur le **fait expert**.
4. Lia ne « s’offusque » pas : ton humble, proposition d’actions (procédure, pièce, etc.).

## Objectifs agent (Goals) — pas d’étapes linéaires

`COMPREHEND_SITUATION` → `COLLECT_MISSING_FACTS` → `OBTAIN_VISUAL_EVIDENCE` → `RUN_DIAGNOSTIC` → … selon **SharedState**, pas `étape 1 / étape 2` en dur.

---

*Dernière mise à jour : mai 2026 — aligné sur NestJS Lia + Pro Briefing + rectification expert.*
