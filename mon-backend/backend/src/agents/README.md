# Agents — écosystème IA LE LOCATAIRE

Structure unifiée (ex-`src/lia/`) alignée sur Savoir-Voir et le golden `docs/tests/REF_EAU_SAVONNEUSE.md`.

| Dossier | Rôle |
|---------|------|
| `shared/` | `DiagnosticState`, capteurs, `DiagnosticContextService`, `diagnostic-ticket-insights` |

### Services IA branchés sur `DiagnosticContextService` (V1 cœur)

| Service | Rôle |
|---------|------|
| `ai-routing` | Pipeline mobile — verdict, payload enrichi |
| `AiPhotoService` / pathologiste | Vision + capteurs |
| `AiLegalService` / `AiInsuranceService` | Bases légales & sinistre (refoulement EU, etc.) |
| `AiTicketService` | Pré-analyse texte / brief ticket |
| `AiDispatchService` | Score artisan (catégorie + capteurs) |
| `AiQualityService` | Rapport intervention + brief diagnostic |
| `AiSupportService` | Classification support (urgence / social / facturation) |
| `AiSocialService` | Risque social (`detectSocialSignal` unifié) |
| `SocialCasesService` | Dossiers sociaux + `triggerTicketDiagnostic` |
| `LiaSharedStateService` | État conversation locataire |

**Hors diagnostic ticket** : `AiDiagnosticsService` (journal RGPD anonymisé), `AiSummarizerService` (synthèse à partir des sorties pipeline).
| `orchestrateur/` | Conversation, intake, DTO — flux locataire |
| `chercheur/` | Research, index pathologies, contexte logement |
| `diagnostiqueur/` | Règles métier, pipeline, briefing expert |
| `referent/` | Référents humains (API `/agents/me/reclamations`) — hors IA Lia |

Les imports historiques `../lia/*` restent valides via des **réexports** dans `src/lia/`.
