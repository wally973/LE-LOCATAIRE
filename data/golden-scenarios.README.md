# Scénarios or — Lia LLM-first

Fichier principal : [`golden-scenarios.json`](golden-scenarios.json)

## Rôle

Ces 10 scénarios vérifient le **dialogue locataire** (compréhension naturelle), pas le verdict juridique agence. Le diagnostic technique reste validé par le pipeline `ai-routing` + bases internes.

## Commandes

Depuis `mon-backend/backend` :

```bash
npm run test:golden
```

Structure + évaluateur (sans Groq).

```bash
# GROQ_API_KEY dans .env
npm run test:golden:live
```

Exécute chaque scénario avec Lia (LLM-first).

## Modifier un scénario

1. Éditer `golden-scenarios.json` (titre, description, `turns`, `expectations`).
2. `mustNotContain` : phrases que Lia ne doit **pas** dire.
3. `mustMentionAny` : au moins un mot attendu dans la réponse.
4. `intakeCompleteOnOpening` : l’intake doit passer en `DONE` dès l’ouverture.
5. `maxHostQuestions` : nombre max de `?` dans les messages Lia.

## Architecture

| Couche | Fichier |
|--------|---------|
| Données | `data/golden-scenarios.json` |
| Compréhension | `src/agents/comprehension/lia-llm-first-comprehension.service.ts` |
| Intake réactif | `src/agents/orchestrateur/intake/lia-intake-reactive.service.ts` |
| Validation diagnostic | `src/ai-routing/` (inchangé — règles après dialogue) |
