# Architecture Grock — Noyau cognitif à 5 têtes, IA-agnostique

> Document de référence. Toute évolution de Grock doit respecter ce plan.
> Statut : validé par le porteur (3 juillet 2026) · pipeline pack T3–T5 livré (6 juillet 2026).

## Principe directeur

> **L'IA fournit le muscle (le langage). Grock impose la discipline (les 5 têtes) et le savoir (le métier).**

Le comportement reste **stable même si on change d'IA** (Mistral, GPT, Claude, Llama…), et
le moteur est **réutilisable pour d'autres applications** en changeant uniquement le pack métier.

### Métaphore fondatrice

Une IA seule = un **chien à une tête** (mono-flux : une seule logique, une seule perspective).
En entrant dans Grock, elle devient une **créature à 5 têtes** : Grock la décompose, la canalise,
la structure. L'IA n'est plus le cerveau — **Grock est le cerveau**, l'IA n'est qu'un opérateur de langage.

---

## Les 4 couches

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
├─────────────────────────────────────────────┤
│  COUCHE 0 — PRÉPROCESSEUR                     │  ← prépare le signal avant raisonnement
│  nettoie · normalise · perception invariante  │     contextualise selon le rôle
└─────────────────────────────────────────────┘
```

---

## Couche 0 — Le PRÉPROCESSEUR

**Rôle** : préparer le signal **avant** les 5 têtes. Il nettoie, normalise et contextualise
l'image et le texte selon l'interlocuteur (locataire, technicien, bailleur, admin).

- **Texte** : normalisation unicode / espaces — sans interprétation sémantique.
- **Image** : perception visuelle **brute et invariante** (aveugle au titre, récit, hypothèse).
  Élimine la variance de cadrage : la même photo doit produire la même description de pixels.
- **Rôle** : bloc signalement contextualisé (mobile locataire, terrain technicien, patrimoine bailleur, gouvernance admin).
- **Sortie** : `PreprocessedSignal` — base commune injectée au noyau (Couche 2) et au pack (Couche 3).

**Invariant** : le préprocesseur **ne diagnostique pas**. Il stabilise la matière première ;
l'interprétation vit dans les Têtes 1–5.

**Code** : `src/grock/preprocessor/` · branché dans `GrockService.runTurn` avant le prompt maître.

**Scores (0–10)** : `signalQuality` (Couche 0) + scores par tête (Couche 2) — internes, journalisés, sondes offline. Voir `kernel/grock-confidence-scores.ts`.

---

## Les 3 couches (noyau → port → pack)

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
| 3 · Déduction | faits validés + savoir métier | hypothèses pondérées (scores) | **pack métier** — le noyau orchestre, ne score pas |
| 4 · Décision | hypothèses + règles métier | **états candidats + doctrine** | **pack métier** — IRSI, sinistre, responsabilité |
| 5 · Résolution | décision | thèmes de parole attendus | **pack métier** — garde-fous parole via `applyParoleSupplements` |

**Deux invariants de sécurité vivent DANS le noyau (jamais dans un JSON de règles) :**
- La Tête 5 sort **toujours** la consigne de sécurité en premier s'il y a danger.
- La Tête 2 **n'invente rien** : elle croise avec l'image réelle (via le port multimodal).

La discipline de « perception neutre avant conclusion » (héritée de l'ancien Pixtral séparé) est
**préservée** : c'est le rôle des Têtes 1 et 2, pas un modèle à part.

**Aujourd'hui → cible** : `GrockService.runTurn` orchestre Couche 0 → Têtes 1–2 (noyau) → Têtes 3–5 (pack) → Port IA.
Les blocs prompt par tête sont injectés via `buildGrockHeadInputs(signal, domainPack)`.

---

## Pipeline head-input — T1/T2 noyau, T3–T5 pack (juillet 2026)

> Validé et livré en 5 phases (6 juillet 2026). 89 tests Jest `src/grock`.

### Principe

Après la Couche 0 (`PreprocessedSignal`), le **noyau** ne calcule que les Têtes 1 et 2.
Les Têtes 3 à 5 sont entièrement fournies par le **pack métier** via `DOMAIN_PACK` — aucune logique
sinistre / infiltration / IRSI dans `preprocessor/` ni dans les modules T3–T5 du noyau.

```
PreprocessedSignal
       │
       ▼
head-input/ (noyau)          domain/ (pack Couche 3)
  T1 buildHead1AnalysisInput      enrichHead3(ctx)
  T2 buildHead2VerificationInput  enrichHead4(ctx, head3)
       │                          enrichHead5(ctx, head3, head4)
       └──────── HeadEnrichmentContext ────────┘
                       │
                       ▼
              GrockHeadInputs + promptBlocks[5]
                       │
                       ▼
              GrockService → LLM_OPERATOR
                       │
                       ▼
              domainPack.applyParoleSupplements(...)
```

### Contrat `GrockDomainPack` (`domain/domain-pack.port.ts`)

| Méthode | Rôle |
|---|---|
| `intercomKnowledge` | Savoir injecté prompt (doctrine, AFPOL, opérations) |
| `pathologyKnowledge` | Consultation pathologie experte |
| `enrichHead3` | Hypothèses pondérées (scores 0–10, pas de verdict) |
| `enrichHead4` | États candidats, doctrine assurance, IRSI/recours |
| `enrichHead5` | Thèmes de parole attendus (checklist, pas de script) |
| `serializeHeadInputsJournal` | Snapshot admin/debug T3–T5 |
| `applyParoleSupplements` | Garde-fous parole locataire post-parse (Tête 5) |

Implémentation pilote : `SocialHousingGuyanePack` → `domain/packs/social-housing/`.

Pack neutre (tests, défaut sûr) : `empty-head-enrichment.ts`, `empty-parole-supplement.ts`.

### Carte du code (pipeline 5 têtes)

```
src/grock/
  preprocessor/                          Couche 0 — pur (pas de sinistre)
  head-input/                            Noyau T1/T2 + pipeline
    head1-analysis.input.ts
    head2-verification.input.ts
    head-input.pipeline.ts               buildGrockHeadInputs(signal, domainPack)
    head-input.types.ts                  Head1, Head2, GrockHeadInputs
  domain/
    domain-pack.port.ts                  DOMAIN_PACK + GrockDomainPack
    head-pack.contract.ts                Types T3–T5 (contrat pack, hors noyau)
    head-enrichment.types.ts             HeadEnrichmentContext, Head*PackOutput
    parole-supplement.port.ts            ParoleSupplementInput
    packs/social-housing/                Métier logement (T3–T5 + parole)
      head3-deduction.input.ts
      head4-decision.input.ts
      head5-resolution.input.ts
      head5-parole-supplement.ts
      head-enrichment.ts
  fixtures/
    generic-tenant-signal.fixture.ts     Tests isolation noyau (hors infiltration)
    infiltration-plafond-mobile.fixture.ts   Cas REF mobile validé terrain
```

### Tests de référence

- `domain/noyau-pack-split.spec.ts` — T1/T2 identiques entre packs ; signal générique sans sinistre
- `domain/packs/social-housing/social-housing-head.pipeline.spec.ts` — métier infiltration
- `infiltration-plafond-mobile.regression.spec.ts` — REF mobile (voisin du dessus obligatoire)
- `docs/tests/REF_INFILTRATION_PLAFOND_MOBILE.md` — fiche cas de référence

### Phases de migration (réalisées)

1. **Contrat pack** — `enrichHead3/4/5` sur `GrockDomainPack`
2. **Déplacement physique** — modules T3–T5 → `domain/packs/social-housing/`
3. **Purge noyau** — types T3–T5 dans `head-pack.contract.ts` ; journal délégué au pack
4. **Tests split** — fixtures génériques, isolation noyau ↔ pack
5. **ParoleSupplementPort** — `applyParoleSupplements` ; `GrockService` ne importe plus le pack en dur

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
  preprocessor/               Couche 0 — préprocesseur (signal normalisé + perception invariante)
  head-input/                   Couche 2 — T1/T2 noyau + pipeline vers pack
  grock.prompt.ts               Couche 2 — prompt maître générique (identité + contrat)
  kernel/grock-five-heads.ts    Couche 2 — les 5 têtes (structure typée + rendu)
  grock.service.ts              Couche 2 — orchestration (préprocesseur → pack → LLM_OPERATOR)
  port/                         Couche 1 — PORT IA (llm-operator.port.ts, mistral.operator.ts)
  domain/                       Couche 3 — PACK MÉTIER (DOMAIN_PACK, packs/social-housing/)
```

---

## Finalité produit — un seul cerveau, trois surfaces

> Validé par le porteur — 4 juillet 2026.

Grock n'est **pas** trois robots (locataire / admin / technicien). C'est **le même moteur cognitif** (5 têtes + Port IA + pack métier) avec un **interlocuteur** différent :

| Surface | Interlocuteur | Exemple |
|---|---|---|
| Mobile / intercom | `tenant` | « Il fait noir, j'allume la lumière » → réponse conversationnelle située |
| Administration | `admin` | « Pourquoi n'as-tu pas signalé ce cas ? », stats journal, gouvernance |
| Terrain | `technician` | Aide au diagnostic pathologique sur site (photo, preuves, priorités) |
| Patrimoine | `landlord` | Synthèse charge, traçabilité, scores — `POST /landlords/me/grock/converse` |

**Principe de parole** : Mistral porte la conversation visible. Les garde-fous code ne remplacent plus la réponse par des templates par état — seulement confidentialité (codes internes) et rejet des mots nus.

**Voix** (à venir) : écoute → même fil → même `runTurn` → synthèse vocale. Pas un second moteur.

**Apprentissage** : journal → sondes → arbitrage humain → doctrine **par principes** (caillou), jamais scénarios par pièce.

### API admin (conversation)

`POST /grock-learning/converse` — dialogue Architecte avec contexte journal/sondes injecté (`interlocutor: admin`).

### Code

```
kernel/grock-interlocutor.ts   — bloc prompt selon interlocuteur
kernel/grock-parole-guard.ts   — confiance Mistral (pas de templates par état)
```

---

## Boucle d'apprentissage — 3 étages (journal → sondes → arbitrage)

> **Grock n'apprend pas tout seul.** NuclearFlush / Tabula Rasa reste la loi : chaque ticket
> repart d'une ardoise vierge, aucune mémoire fantôme entre sessions. Le seul apprentissage
> autorisé est **la doctrine curée par l'humain** — jamais un auto-ajustement du modèle.
> Cette boucle sert à **fabriquer de la doctrine à partir de l'observation**, sous contrôle.

```
Grock tourne ──► ÉTAGE 1 Journal ──► ÉTAGE 2 Sondes ──► ÉTAGE 3 Arbitrage ──► Doctrine
 (production)     (écrit chaque       (détecte les       (l'humain tranche      (validated →
                   décision)           incohérences)      draft → validated)     injectée)
```

### Étage 1 — Journal de décision (capture)

- Table `grock_decision_journal` (Prisma `GrockDecisionLog`), écriture **best-effort / fire-and-forget** :
  elle **ne modifie jamais** la réponse renvoyée au locataire ni le contrat d'API.
- `GrockDecisionJournalService.record({...})` consigne chaque tour : perception, état, responsabilité,
  parole, note interne, modèle, modèle vision, et un **`photoHash`** (SHA-256 du base64) qui permet
  de regrouper les décisions prises sur **la même photo**.
- Rôle : constituer la matière première d'analyse **hors ligne**, sans impacter le chemin locataire.

### Étage 2 — Sondes de qualité (détection offline)

- `grock-quality-probes.ts` — 4 sondes qui lisent le journal et remontent des `GrockLessonCandidate` :
  - `variance_cadrage` : **même photo, décisions divergentes** selon le cadrage du récit (le signal le plus important : la responsabilité doit s'ancrer sur les faits, pas sur la formulation).
  - `fuite` : identifiant / jargon interne détecté dans une parole locataire.
  - `degenerescence` : parole dégénérée (mono-mot, vide, non auto-suffisante).
  - `preuve_avant_conclusion` : conclusion posée sans preuve visuelle.
- Exécution offline : `scripts/grock-quality-report.ts` (dump JSON des candidats), utilisable en CI/cron.

### Étage 3 — Arbitrage humain (décision + écriture de doctrine)

- **Aucune écriture automatique.** L'Architecte transforme un cas en **leçon** ; le gate de signature
  est le passage **`draft → validated`** dans `GROCK_DEDUCTION_LEDGER.json`
  (`loadGrockDeductionDoctrine` n'injecte **que** les `validated`).
- Backend (ADMIN) : `GrockLearningController` / `GrockLearningService` + `grock-doctrine-writer.ts`
  (`appendDraftLesson`, `signLesson`, `rejectLesson` — refus impossible sur une leçon déjà validée).
  Endpoints : `GET /grock-learning/candidates`, `GET /grock-learning/lessons`,
  `POST /grock-learning/lessons`, `POST /grock-learning/lessons/:id/sign`, `DELETE /grock-learning/lessons/:id`.
- Dashboard : page **« Apprentissage Grock »** (`/admin/grock-learning`) — cas à arbitrer à gauche,
  doctrine (draft + validated) à droite, formulaire de leçon pré-rempli selon le type de cas.
- Invalidation de cache : une leçon signée est vue au **tour suivant** (`invalidateGrockLedgerCache`).

#### Runbook d'arbitrage (Architecte)

1. Ouvrir **`/admin/grock-learning`** → lire les **cas à arbitrer** (sévérité, résumé, preuves).
2. Pour un cas pertinent, cliquer **« Rédiger une leçon »** : le formulaire propose un identifiant et un
   gabarit selon le type de sonde. Vérifier / réécrire `principe`, `déplacement de raisonnement`,
   `thinking`, `parole locataire`, ajouter des exemples transférables. **Rester en langage métier neutre**
   (« le locataire », jamais de prénom ni d'identifiant interne).
3. **Créer le draft** : la leçon est enregistrée en `draft` — **elle n'influence pas encore Grock**.
4. Relire, puis **« Signer (valider) »** → la leçon passe `validated`, signataire + date tracés ;
   elle sera injectée au prochain raisonnement du (des) domaine(s) ciblé(s).
5. Un cas non pertinent : **« Rejeter »** (uniquement possible sur un draft — la doctrine active est protégée).

#### Carte du code (boucle d'apprentissage)

```
src/grock/learning/
  grock-decision-journal.service.ts  Étage 1 — capture (record, hashImage, loadForAnalysis)
  grock-quality-probes.ts            Étage 2 — 4 sondes → GrockLessonCandidate
  grock-doctrine-writer.ts           Étage 3 — append draft / sign / reject (écrit le ledger)
  grock-learning.service.ts          Étage 3 — orchestration (candidats + cycle de doctrine)
  grock-learning.controller.ts       Étage 3 — endpoints ADMIN
  grock-learning.module.ts           câblage (importé dans app.module.ts)
scripts/grock-quality-report.ts      Étage 2 — rapport offline des candidats
knowledge/doctrine/GROCK_DEDUCTION_LEDGER.json   la doctrine (draft/validated)
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
