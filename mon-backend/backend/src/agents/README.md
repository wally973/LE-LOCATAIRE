# Agents — écosystème IA LE LOCATAIRE

Structure unifiée (ex-`src/lia/`) alignée sur Savoir-Voir et le golden `docs/tests/REF_EAU_SAVONNEUSE.md`.

| Dossier | Rôle |
|---------|------|
| `shared/` | `DiagnosticState`, capteurs, `DiagnosticContextService` |
| `orchestrateur/` | Conversation, intake, DTO — flux locataire |
| `chercheur/` | Research, index pathologies, contexte logement |
| `diagnostiqueur/` | Règles métier, pipeline, briefing expert |
| `referent/` | Référents humains (API `/agents/me/reclamations`) — hors IA Lia |

Les imports historiques `../lia/*` restent valides via des **réexports** dans `src/lia/`.
