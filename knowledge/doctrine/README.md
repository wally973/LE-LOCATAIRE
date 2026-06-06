# Doctrine Jarvis — Le Stylo des agents

Ce répertoire est le **carnet d'héritage** du Système de Conscience Patrimoniale.

## Rôle

Après délibération, les agents (Enquêteur, Archiviste, Majordome) peuvent proposer une **leçon de doctrine** via le champ JSON `doctrineLesson`. Le backend l'enregistre ici via `living-doctrine-stylo.ts`.

## Format des fichiers

Un fichier par leçon : `YYYY-MM-DD-<slug>.md`

```markdown
---
author: enqueteur | archiviste | majordome | architecte
createdAt: ISO-8601
sessionRef: optional
title: Titre court
---

Corps de la leçon en prose libre.
```

## Validation

Les leçons auto-générées restent **brouillons** jusqu'à revue de l'Architecte.
Seules les leçons validées alimentent la bibliothèque agents en Phase C.

## Code

- Écriture : `mon-backend/backend/src/agents/orchestrateur/living-intelligence/living-doctrine-stylo.ts`
- Lecture agents : `loadDoctrineBibliotheque()`
