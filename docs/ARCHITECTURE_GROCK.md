# Architecture Grock — Noyau cognitif à 5 têtes, IA-agnostique

> Document de référence. Toute évolution de Grock doit respecter ce plan.
> Statut : validé par le porteur (3 juillet 2026).

## Principe directeur

> **L'IA fournit le muscle (le langage). Grock impose la discipline (les 5 têtes) et le savoir (le métier).**

Le comportement reste **stable même si on change d'IA** (Mistral, GPT, Claude, Llama…), et
le moteur est **réutilisable pour d'autres applications** en changeant uniquement le pack métier.

### Métaphore fondatrice

Une IA seule = un **chien à une tête** (mono-flux : une seule logique, une seule perspective).
En entrant dans Grock, elle devient une **créature à 5 têtes** : Grock la décompose, la canalise,
la structure. L'IA n'est plus le cerveau — **Grock est le cerveau**, l'IA n'est qu'un opérateur de langage.

---

## Les 3 couches

```
┌─────────────────────────────────────────────┐
│  COUCHE 3 — PACK MÉTIER (interchangeable)     │  ← logement social Guyane (aujourd'hui)
│  pathologies · juridique · opérations · clim  │     … ou tout autre domaine demain
├─────────────────────────────────────────────┤
│  COUCHE 2 — NOYAU GROCK (les 5 têtes)         │  ← le cerveau structurel, générique
│  Analyse→Vérif→Déduction→Décision→Résolution  │     ne connaît AUCUN domaine
├─────────────────────────────────────────────┤
│  COUCHE 1 — PORT IA (opérateur de langage)    │  ← Mistral aujourd'hui, GPT/Claude demain
│  une seule interface, modèle interchangeable  │     multimodal (voit) ou texte
└─────────────────────────────────────────────┘
```

---

## Couche 1 — Le PORT IA (opérateur de langage)

**Rôle** : la seule porte par laquelle Grock parle à un modèle. Grock ne doit **jamais**
prononcer « Mistral » ailleurs qu'ici.

- Interface unique : `raisonner(prompt, historique, image?) → réponse structurée`.
- Implémentations branchables : `OperateurMistral` (aujourd'hui), puis `OperateurGPT`, `OperateurClaude`, `OperateurLlama`.
- **Multimodal intégré** : l'opérateur reçoit l'image **directement** → plus de « jeu du téléphone »
  (aujourd'hui l'IA de raisonnement ne reçoit qu'une *description texte* de la photo, jamais les pixels ;
  c'est la source d'hallucinations comme « fissure sur l'évier » inventée à partir de « fuite sous l'évier »).
- Repli configurable, lui aussi **multimodal** (pas un modèle aveugle).

**La vision est une propriété de cette couche, pas un module figé.**
- Par défaut : l'opérateur multimodal (ex. Mistral) **voit et raisonne**.
- Option premium débrayable : un **œil spécialisé plus performant** (ex. Pixtral Large ou modèle
  vision dédié bâtiment) branché en amont pour les cas difficiles — sans changer le noyau.

**Aujourd'hui → cible** : `LiaHostService.chatMultiTurnMistral` + `GROCK_MISTRAL_MODEL`
deviennent **une** implémentation du port, cachée derrière l'interface.

---

## Couche 2 — Le NOYAU GROCK (les 5 têtes)

**Rôle** : le cerveau. Il prend l'IA mono-tête et lui **impose 5 passes de raisonnement**.
Il ne connaît **rien** au logement — il sait seulement *comment penser*.

| Tête | Entrée | Sortie | Invariant du noyau |
|---|---|---|---|
| 1 · Analyse | texte + image | faits bruts (rien de déduit) | ne conclut jamais ici ; décrit ce qui est vu |
| 2 · Vérification de réalité | faits | faits validés, impossibles éliminés | **n'invente aucun fait non observé** (anti-hallucination) ; croise avec l'image réelle |
| 3 · Déduction | faits validés + savoir métier | nature du problème | reste dans le domaine prouvé |
| 4 · Décision | nature + règles métier | **état + responsabilité + actions** | responsabilité explicite (bailleur / locataire / tiers / sinistre) |
| 5 · Résolution | décision | message final au locataire | **sécurité d'abord**, parole claire et auto-suffisante |

**Deux invariants de sécurité vivent DANS le noyau (jamais dans un JSON de règles) :**
- La Tête 5 sort **toujours** la consigne de sécurité en premier s'il y a danger.
- La Tête 2 **n'invente rien** : elle croise avec l'image réelle (via le port multimodal).

La discipline de « perception neutre avant conclusion » (héritée de l'ancien Pixtral séparé) est
**préservée** : c'est le rôle des Têtes 1 et 2, pas un modèle à part.

**Aujourd'hui → cible** : `GrockService.runTurn` devient l'orchestrateur des 5 têtes.
Les « 5 rôles » déjà présents dans le prompt sont **promus** en structure centrale, propre et nommée.

---

## Couche 3 — Le PACK MÉTIER (savoir séparable)

**Rôle** : tout ce qui est spécifique à l'application. Fourni **aux Têtes 3 et 4** comme
connaissance à raisonner — **jamais** comme arbre de décision.

Contenu du pack « LE LOCATAIRE » :
- pathologies bâtiment (climat tropical),
- juridique (décret 87-712 = entretien locatif, loi 89-462…),
- opérations logement social (privatif / commun, gardien / technicien / bailleur),
- règles de responsabilité (bailleur / locataire / tiers / sinistre).

**Réutilisation** : une autre application = **on remplace ce pack**. Le noyau (5 têtes)
et le port IA ne bougent pas.

**Aujourd'hui → cible** : `grock.prompt.ts` (partie métier), `buildGrockDomainPrompt`,
`loadGrockSocialHousingOperationsBlock`, `afpolDocs`, `legal-references.json`,
`pathology-index.json` → regroupés en **un pack métier identifiable**.

---

## Ce qui DISPARAÎT — le faux « Arbor »

Le moteur d'arbre de décision, contraire à la Loi Suprême **et** à la vision 5 têtes :

- `grock/doctrine/grock-arbor-deduction.json` (l'arbre de décision)
- `grock-doctrine-engine.ts` (`applyDoctrineOnParsedOutput`)
- `renderArborRules()` dans `grock-deduction-ledger.ts` (l'injection de l'arbre dans le prompt)
- les appels + tests associés

**Où migrent ses réflexes (rien ne se perd) :**
- « dégât des eaux actif / origine collective → sinistre + assurance 5 jours » → **savoir du pack métier**,
  donné à la Tête 4 (Décision) comme raisonnement, pas comme règle figée.
- « couper le courant » → **invariant sécurité du noyau**, Tête 5.

> Le mot « Arbor » ne doit plus apparaître dans le code : le vrai système cognitif (5 capteurs / 5 têtes)
> vit dans le noyau, pas dans un module nommé.

---

## Correctif de fond inclus — le « toujours bailleur »

La Tête 4 sort la responsabilité **réelle** (`locataire_responsable` / `bailleur_responsable` /
`sinistre` / `tiers`). Le consommateur (`AiRoutingService`) la **traduit fidèlement** —
fin du `READY_TICKET ? BAILLEUR : PENDING` qui écrasait tout.
→ Une fuite de joint sous évier peut enfin conclure **locataire** (entretien locatif, décret 87-712).

---

## Chemin de migration (non-cassant, par étapes) — RÉALISÉ

Chaque étape est **indépendante et testable** (build + suite Jest 214/214) avant la suivante.

- **Étape 1 — Purge + vérité de la décision** ✅
  Faux Arbor supprimé ; réflexes migrés (sécurité → noyau Tête 5, sinistre/assurance → pack) ;
  mapping de responsabilité réparé (Tête 4 fidèle : `grockStateToResponsibility`).
  → règle le « toujours bailleur » vu en production.

- **Étape 2 — Port IA + vue** ✅
  Opérateur de langage abstrait (`src/grock/port/`, jeton `LLM_OPERATOR`, impl. `MistralOperator`) ;
  raisonnement multimodal (l'IA voit l'image directement via le dernier tour locataire).
  → tue l'hallucination « fissure ».

- **Étape 3 — Séparer le pack métier** ✅
  Savoir logement isolé (`src/grock/domain/`, jeton `DOMAIN_PACK`, impl. `SocialHousingGuyanePack`) ;
  le noyau ne dépend plus que de `DOMAIN_PACK`.
  → rend Grock réutilisable pour d'autres applications.

- **Étape 4 — Nommer les 5 têtes** ✅
  Structure typée `GROCK_FIVE_HEADS` (`src/grock/kernel/grock-five-heads.ts`) ; prompt maître
  rendu **générique** (identité + 5 têtes + contrat) ; tropicalisation / responsabilité / sinistre
  déplacés dans le pack (`social-housing-metier.prompt.ts`). Plus aucun « Arbor » dans le code.

### Carte du code (état final)

```
src/grock/
  grock.prompt.ts             Couche 2 — prompt maître générique (identité + contrat)
  kernel/grock-five-heads.ts  Couche 2 — les 5 têtes (structure typée + rendu)
  grock.service.ts            Couche 2 — orchestration (dépend de LLM_OPERATOR + DOMAIN_PACK)
  port/                       Couche 1 — PORT IA (llm-operator.port.ts, mistral.operator.ts)
  domain/                     Couche 3 — PACK MÉTIER (domain-pack.port.ts, social-housing-*.ts)
```

---

## Position sur Pixtral (vision)

- L'IA de raisonnement **doit recevoir l'image elle-même**, pas seulement une description texte.
  C'est le cœur de la lutte anti-hallucination.
- Pixtral **est** un modèle Mistral (sa version vision) ; `mistral-small-latest` est lui aussi multimodal.
  Un seul modèle peut donc voir **et** conclure.
- Décision : la vision devient une **propriété du Port IA** (Couche 1). Par défaut, l'opérateur
  multimodal voit et raisonne ; un **œil premium reste branchable** pour les cas difficiles.
- La valeur historique de Pixtral (perception neutre séparée) est **conservée** sous forme de
  discipline dans les Têtes 1 et 2, pas sous forme de modèle imposé.
