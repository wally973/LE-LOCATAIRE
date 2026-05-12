# PRD interne — Module IA « Le Locataire »

Document de référence produit / sécurité pour l’assistant conversationnel, l’avatar mobile, la mémoire technique anonymisée et la coordination des modules.

## 1. Objectifs

- Aider l’utilisateur **uniquement** dans le périmètre logement + utilisation de l’application.
- Fournir une **information générale** sur le cadre locatif **sans** conseil juridique personnalisé.
- Proposer une **expérience multilingue** (fr, en, ht, pt-BR, es-DO) avec traduction contrôlée côté backend à terme.
- **Bride (guardrail)** obligatoire avant toute chaîne de traitement.
- **Journalisation technique** sans texte brut utilisateur (table `ai_diagnostics`, hash utilisateur).

## 2. Bride IA (`useAIGuardrail` / `evaluateGuardrail`)

- Toute entrée utilisateur est analysée **avant** la suite du pipeline métier (`executeAIPipelineSync` étape 1).
- **Autorisé** : logement, bailleur/locataire, réparations, tickets, paiements, quittances, RDV liés au logement, médiation dans ce cadre, références CLCV / ADIL comme **recours**, navigation dans l’app, médiation/sociaux lorsque clairement rattachés au cadre « logement / immeuble ».
- **Refus** : politique, religion, santé/médecine, immigration, fiscalité, droit du travail / pénal / famille, histoire/culture générale, météo, conversation libre, traduction hors contexte, analyse de documents externes, conseil juridique personnalisé, questions personnelles hors logement/app.
- **Mode RGPD strict** (réglage global locataire, **activé par défaut**) : refus automatique si détection probable d’adresse nominative, téléphone ou e-mail, ou formulations « mon nom », « mes coordonnées », etc.
- Messages : standard FR défini dans `legalDisclaimer.ts` ; variantes refus périmètre dans `refusalMessages.i18n.ts`.
- En cas de refus : événement **`le-locataire:ai-guardrail-refusal`** ; l’avatar en **mode refus** (bulle rouge, shake, message multilingue si locale ≠ fr).
- **Nettoyage minimal** : `minimalCleanText` exporté (`evaluateGuardrail.ts`).

## 3. IA juridique (version finale rectifiée)

**Autorisé**

- Classifier le sujet en **locatif**, **bailleur** ou **flou** (heuristique textuelle informative, sans valeur juridique).
- **Évoquer** lois/décrets en rappelant de **vérifier les textes à jour sur Légifrance** ; pas d’interpétation personnalisée ni d’application à un dossier précis.
- Expliquer **obligations générales** bailleur vs locataire (grandes lignes).
- Recours types : **CLCV**, **ADIL**, médiation/conciliation, **juriste**.
- Reformuler une **porte agressive** vers un ton neutre ; **tempérer** un locataire en colère avec une courte introduction empathique puis cadre général.

**Interdit**

- Conseil juridique **personnalisé**, lecture/traduction/interprétation de **contrat**, tranchage de litige, injonctions « vous devez légalement… », droit **hors logement** (déjà filtré par la bride).

**Phrase finale obligatoire**

> Pour toute décision ou question juridique, veuillez consulter un juriste ou une association spécialisée (CLCV, ADIL).

Implémentation front : `useLegalAI.buildInformativeRentalBrief` + `LEGAL_AI_FINAL_CATCHPHRASE_FR`.

## 4. Pipeline orchestrateur

Ordre **strict** :

1. **Guardrail** — `evaluateGuardrail` (options `rgpdStrictMode` ; refus → événement refusal, arrêt chaîne ; message multilingue).
2. **Cleaning** — `useCleaningAI.sanitizeUserInput` (NFKC + espaces, via `minimalCleanText`).
3. **Diagnostic** — `useDiagnosticAI.suggest`.
4. **Juridique informative** — `useLegalAI.buildInformativeRentalBrief`.
5. **Communication** — `useCommunicationAI`.
6. **Multilingue** — `useMultilingualAI.adaptUserFacingText`.
7. **Avatar** — événement **`le-locataire:ai-pipeline-output`** puis `AvatarCoachContext` (coach mobile, overlay).

Point d’entrée : **`useOrchestratorAI().runPipeline(text, { locale, rgpdStrictMode, silentAvatar, skipAiDiagnosticRecord })`** et **`useAvatarCoach().runAssistantPipeline`**.

Après succès/refus mesurable : enregistrement optionnel **`POST /ai-diagnostics/record`** (JWT) avec **résumé nettoyé** jamais le texte brut ; désactivable via `skipAiDiagnosticRecord` (formulaire test paramètres).

## 5. Avatar mobile 2D

- Overlay devant l’interface, **réglable** (paramètres locataire — `useLocataireAvatarSettings`).
- Expressions : neutre, aide, alerte, explication, confirmation (mapping pipeline / route).
- **Orchestrateur** : suggestions de route `suggestForRoute(pathname)`, pointage **`[data-coach]`**.
- Animations mode refus (shake + tonalité rouge côté UI existante).
- Packs/versioning/admin : module **`AdminAvatarsPage`** (`avatarAdminStore`).

## 6. Mémoire IA technique (`ai_diagnostics`)

### Schéma (Prisma model `AiDiagnostic`, table PostgreSQL `ai_diagnostics`)

- `id` (UUID), `createdAt`.
- `userHash` — SHA256(`userId` + secret serveur ; env `AI_DIAGNOSTIC_SALT` ou repli développement).
- `locale`, `category`, `severity`, `target` (ADMIN/LANDLORD/ARTISAN/NONE).
- `refused`, `refusalReason`.
- **`diagnosticSummary`** — métadonnées / snippet nettoyé **jamais** la transcription brute utilisateur depuis le flux normal.
- `pipelineSteps` (JSON).
- `avatarVariant`, `artisanType`, `bailleurFlag`, `adminFlag`.

### Règles & API

- Aucune **PII intentionnelle** dans le champ summary côté client ; le serveur ré-applique un **sanitize** léger (`AiDiagnosticsService.sanitizeSummary`).
- **Suppression** par utilisateur : `DELETE /tenant/me/ai-diagnostics`.
- **Rétention** : 30 jours recommandés — `POST /admin/ai-diagnostics/purge?days=30` (cron ou tâche planifiée).
- **Stats admin** : `GET /admin/ai-diagnostics/stats` agrégées 30 derniers jours.

## 7. Statistiques IA — Dashboard admin

Page **`/admin/ia-stats`** : totaux acceptés/refusés, orientation artisan/bailleur/admin, répartition locale, catégories problème, volumes par heure / jour UTC (graphiques simples histogrammes et camemberts).

## 8. RGPD côté locataire

- Toggle **« Mode RGPD strict »** dans **Paramètres** (`localStorage`).
- Bouton **« Supprimer mon historique IA »** → `DELETE /tenant/me/ai-diagnostics`.

## 9. Multilingue

- Locale défaut `fr` ; même bride et pipeline ; refus périmètre traduits dans `refusalMessages.i18n.ts`.

## 10. Sécurité

- Ne pas ajouter de « contournements » avant le guardrail.
- Toute intégration LLM futur passe par **guardrail serveur + post-validation**.

---

*Mise à jour : pipeline + bride RGPD strict, classement juridique locatif/bailleur/flou, table `ai_diagnostics`, purge 30 j, page admin IA stats, suppression historique tenant.*
