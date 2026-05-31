# Architecture — moteur unique & écoute locataire

Document court (A) — complété mai 2026.

## Principe

**Un cerveau, plusieurs bouches.**

| Couche | Rôle | Implémentation |
|--------|------|----------------|
| **Faits** | Ce que le locataire a dit (où, quoi, déjà signalé) | `lia-tenant-signalement-facts.ts` → `jarvisFacts` / simulation |
| **Cerveau** | Décider (physique, charge, recherche) | Simulation Jarvis, Savoir, juriste (JSON + règles) |
| **Bouche** | Parler selon le persona | `lia-jarvis-dialogue.i18n` + synthèse council |
| **Garde-fou** | Rectification expert, blocage incohérence | `EXPERT_VALIDATED`, handoff |

## Personas (même vérité, droits différents)

| Persona | Interface | Ce qu’il voit |
|---------|-----------|---------------|
| **Locataire** | Flutter / Lia-Lab chat | Jarvis — empathie, pas de jargon |
| **Technicien** | Pro Briefing, compagnon | Faits + hypothèses + marchés |
| **Bailleur** | Dashboard, stats (à venir) | Tags, délais, agrégats |
| **Admin** | Config app | Hors diagnostic ticket |

## Règles d’écoute (B) — générales, pas par sujet

1. **Extraire** lieu / salubrité / relance depuis titre + description + fil.
2. **Ne pas re-sonder** le périmètre si hall, escalier ou parties communes déjà cités.
3. **Ne pas poser** de question TV/VMC/antenne sur un fil **salubrité communs**.
4. **Reformuler** avant toute nouvelle question (« je vous ai entendu : … »).
5. **Clôturer l’intake** quand les faits suffisent (ex. hall insalubre déjà localisé).

## Fichiers clés

- `lia-tenant-signalement-facts.ts` — extraction & interdictions de sondes
- `lia-jarvis-simulation.engine.ts` — applique les faits à la simulation
- `lia-jarvis-pilot.service.ts` — tour locataire production + Lia-Lab
- `LiaSharedState` / `jarvisFacts` — vérité partagée ticket

## Suite

- Enrichir les **classes** de faits (fuite, porte…) avec la même mécanique
- Brancher bailleur stats sur `tenant_lead`, `tenant_common_areas`
- Rectification expert → met à jour une **directive**, pas un patch isolé
