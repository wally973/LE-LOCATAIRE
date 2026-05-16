# LE LOCATAIRE — Notes de projet

Document de synthèse regroupant les **résumés de fin de session** (assistant + développement backend).  
Dernière mise à jour : **16 mai 2026**.

---

## 0. Public du document et mode d’échange

Le porteur du projet **n’est pas développeur**. Il peut à tout moment demander des **explications en langage simple** sur un terme technique, une étape de travail, un choix d’architecture ou ce que signifie concrètement une livraison — afin de bien comprendre avant de valider la suite.

**Attentes vis-à-vis de l’assistant (Cursor)** :

- Privilégier le **pourquoi métier / produit** avant le **comment technique**.
- Définir les acronymes et mots techniques à la **première occurrence** (ex. API, migration, push, stub, JWT).
- Utiliser des **exemples concrets** (parcours locataire, bailleur 2terHabitat, notification sur le téléphone).
- Éviter d’enchaîner du jargon sans pause ; proposer « je détaille si besoin » sur les points sensibles.
- Ne pas supposer que le vocabulaire du code est évident pour tout le monde.

**Pour le porteur du projet** : aucune question n’est « trop basique » — mieux vaut clarifier un point (ex. « c’est quoi une migration ? », « pourquoi Groq ? ») que valider à l’aveugle.

---

## 1. Vision produit (rappel)

Application **technique multilingue** (Guyane) pour locataires et bailleurs : le locataire signale un désordre (texte + photo) ; plusieurs **IA** classifient et routent la réclamation (charge bailleur, locatif, social, non recevable) pour **limiter les déplacements** du technicien / responsable de site.

- **Prestataires** : pas de gestion complète dans l’app en V1 ; les demandes d’artisan « à charge locataire » partent vers l’**owner** (admin plateforme), pas le marché des bailleurs.
- **Multilingue / avatar 2D** : prévu plus tard (créole, espagnol, anglais, brésilien).
- **Extensions futures** (sans casser le socle) : enquêtes OPS/SLS, relances obligatoires bailleur, assurances, **modules activables par bailleur** (feature flags côté admin).

**Stack backend** : `mon-backend/backend` — NestJS 11, Prisma 5, PostgreSQL (Supabase), JWT, Swagger.  
**Frontends** (hors scope des sprints ci-dessous) : `admin-dashboard`, `web-admin`, `web-bailleur`, `mobile/flutter`.

**Commandes utiles** (toujours depuis `mon-backend/backend`) :

```powershell
cd "C:\Users\ewald\Desktop\LE LOCATAIRE\mon-backend\backend"
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start:dev
```

Swagger : `http://localhost:3000/api`

---

## 2. Décisions produit validées (cadrage initial)

| # | Sujet | Décision |
|---|--------|----------|
| Q1 | Multi-tenant | Filtrage applicatif strict (`landlordProfileId` / scope JWT) |
| Q2 | Hiérarchie | `Bailleur → Agence (optionnel) → Agent` ; permissions fines plus tard |
| Q3 | Onboarding locataire | Self-service : choix du bailleur, compte en attente, validation bailleur |
| Q4 | Escalade IA | **2 essais** max → escalade bailleur (`ESCALADE_BAILLEUR`) |
| Q5 | Vidéos | Archive interne d’abord (stub), YouTube en Sprint 8+ |
| Q6 | Non recevables | Traçabilité + message locataire ; compteur bailleur plus tard |
| Q7 | Artisans flow locataire | Ticket vers admin (owner), pas module `artisans/` bailleur |

---

## 3. Historique Git (backend — branche `main`)

| Commit | Sprint | Message |
|--------|--------|---------|
| `7c7fd290` | — | Version stable : Auth OK |
| `ad221bdc` | **1** | feat(backend): fondation multi-tenant SaaS (sprint 1) |
| `0638fdeb` | **2** | feat(backend): onboarding locataire self-service (sprint 2) |
| `9551f5da` | **3** | feat(backend): routage automatique IA des tickets locataire (sprint 3) |
| `924b5406` | **4** | feat(backend): vidéothèque IA + demandes d'artisan (sprint 4) |
| `0a2f14ea` | **5** | feat(backend): backoffice volet social — cas, référents, journal (sprint 5) |
| `79a6bc62` | **6** | feat(backend): notifications réelles SMTP/FCM + feature flags bailleur (sprint 6) |
| `8afc7698` | **D** | feat: dashboard bailleur IA et escalades (sprint D) |

Migrations Prisma associées (dossier `mon-backend/backend/prisma/migrations/`) :

- `20260514103000_multitenant_foundation`
- `20260514120000_tenant_registration_request`
- `20260514150000_ai_ticket_routing`
- `20260514190000_video_library_and_artisan_requests`
- `20260515100000_social_case_backoffice`
- `20260515120000_notifications_and_feature_flags`
- `20260515140000_lia_conversation` (Sprint F)

---

## 4. Résumés par session

### Session 0 — Analyse initiale & feuille de route (14 mai 2026)

**Contexte** : reprise du projet après accumulation de code non commité ; analyse du dépôt et du fichier `Processus application.xlsx`.

**Constats** :

- Deux modèles parallèles (annuaires `Bailleur` / `Locataire` / `BienImmobilier` vs métier `LandlordProfile` / `TenantProfile` / `Housing`).
- Modules legacy opérationnels (auth, admin, HLM, IA diagnostics, tickets, etc.).
- Risque : pas de commit récent, migrations à synchroniser avec Supabase.

**Décisions** : valider le plan en 6 sprints (multi-tenant → onboarding → IA → vidéos/artisan → social → …).  
**Suite** : Sprint 1 après sauvegarde git.

---

### Sprint 1 — Fondation multi-tenant SaaS

**Commit** : `ad221bdc`

**Livré** :

- Suppression des annuaires doublons (`Bailleur`, `Locataire`, `BienImmobilier`).
- `ContratLocation` / `Paiement` reliés à `LandlordProfile`, `TenantProfile`, `Housing`.
- Modèles `Agence`, `AgentProfile` ; rôle **`AGENT`**.
- **`BailleurScope`** : types, service, guard, décorateur `@BailleurScope()`.
- Filtre multi-tenant sur **contrats** et **paiements** (ADMIN / BAILLEUR / AGENT).
- Migration `20260514103000_multitenant_foundation` ; build OK ; serveur démarre.

**Git** : `.gitignore` enrichi (backend + racine : `projet.txt`, `~$*`, artefacts debug).

---

### Sprint 2 — Onboarding locataire self-service

**Commit** : `0638fdeb`  
**Migration** : `20260514120000_tenant_registration_request`

**Livré** :

- Modèle **`TenantRegistrationRequest`** (PENDING / APPROVED / REJECTED).
- **Public** : `GET /landlords/public`, `POST /auth/register-tenant` (`isAvailable=false`).
- **Bailleur / agent** : liste, détail, approve, reject (`/landlords/me/tenant-requests/...`).
- À l’approbation : création `TenantProfile` + `Housing`, activation compte, notifications.

---

### Sprint 3 — Routage automatique IA des tickets

**Commit** : `9551f5da`  
**Migration** : `20260514150000_ai_ticket_routing`

**Livré** (cœur produit) :

- Enrichissement **`Ticket`** : `responsibility`, `nonRecevableReason`, `aiAttempts`, `aiMaxAttempts` (2), `escalatedAt`, `aiLastDecision`, `landlordProfileId`.
- Statuts : `NEW`, `AWAITING_TENANT_PHOTO`, `AUTO_CLOSED`.
- Module **`ai-routing/`** (port hexagonal + stub déterministe FR).
- À la création d’un ticket : pipeline IA + notifications + trace **`AiDiagnostic`**.
- Cas **SOCIAL** : création **`SocialCase`** + notif bailleur.
- Endpoints : `redo-photo`, `tenant-feedback`, `request-human-review`, `ai-analyze`, `GET /tickets/me/routed`.

**PRD** : seuil confiance 0,75 ; `AUTO_CLOSED` réouvrable ; escalade après 2 tentatives.

---

### Sprint 4 — Vidéothèque IA + demandes d’artisan

**Commit** : `924b5406`  
**Migration** : `20260514190000_video_library_and_artisan_requests`

**Livré** (après décision IA **`LOCATAIRE`**) :

1. **Vidéos** : `VideoTutorialQuery`, `VideoTutorial`, `TicketVideoSuggestion` ; module **`video-library/`** (stub 6 catégories, cache hit/miss).
2. **Artisan** : `ArtisanRequest` → backoffice **admin** (owner), pas le module `artisans/` bailleur.
3. Endpoints locataire : vidéos, feedback, `mark-resolved-by-video`, `POST /tickets/:id/artisan-request`.
4. Admin : `/admin/artisan-requests`, `/admin/video-library`.
5. Bailleur : `GET /landlords/me/artisan-requests` (lecture seule).
6. **P4** : pas de fourchette de prix — message « un devis vous sera proposé ».

Branchement : après routage `LOCATAIRE`, suggestion automatique de tutoriels.

---

### Sprint 5 — Backoffice volet social

**Commit** : `0a2f14ea`  
**Migration** : `20260515100000_social_case_backoffice`  
**PRD validé** : P1–P6 (défauts).

**Livré** :

- **`SocialCase`** : affectation référent, priorité, clôture (`closedReason` obligatoire), `lastContactAt`.
- **`SocialCaseEvent`** : journal append-only.
- **`SocialWorker`** : `@@unique([userId, bailleurId])` ; rôles COORDINATOR / FIELD / EXTERNAL.
- Module **`social/`** activé dans `AppModule`.
- **P1** : accès référent via table `SocialWorker` + `SocialWorkerGuard` (pas de rôle JWT dédié).
- **P2** : bailleur et agent peuvent gérer les dossiers de leur organisme.
- **P3** : locataire voit statut + message générique (`GET /tenant/me/social-case`), pas les notes internes.
- **P4** : clôture dossier → ticket lié en `RESOLVED`.
- **P5** : notes en append horodaté `[date UTC user#id]`.
- **P6** : référent = utilisateur existant uniquement.

**API** :

| Rôle | Routes principales |
|------|-------------------|
| ADMIN | `/admin/social-cases` |
| BAILLEUR / AGENT | `/landlords/me/social-cases`, `/landlords/me/social-workers` |
| Référent social | `/social/me/cases` (dossiers assignés) |
| LOCATAIRE | `/tenant/me/social-case` |

---

### Sprint 6 — Notifications réelles + feature flags bailleur

**Commit** : `79a6bc62`  
**Migration** : `20260515120000_notifications_and_feature_flags`

**6B — Notifications** :

- Ports hexagonaux **email** (SMTP si `SMTP_HOST`, sinon log console) et **push** (FCM si credentials Firebase, sinon log console).
- `notifyUser()` : in-app + email + push selon `UserNotificationSettings`.
- `createNotification()` délègue à `notifyUser()` (rétrocompatibilité modules existants).
- Modèles : `UserNotificationSettings`, `DevicePushToken`, `Notification.readAt`.
- Endpoints : `GET/PATCH /notifications/me/settings`, `POST/DELETE /notifications/me/device-tokens`, `PATCH /notifications/:id/read`.

**6A — Feature flags** :

- Modèle `LandlordFeatureFlags` (9 booléens par module).
- Admin : `GET/PATCH /admin/landlords/:id/feature-flags`.
- Bailleur : `GET /landlords/me/feature-flags` (lecture seule).
- Garde `LandlordModuleGuard` + `@RequiresLandlordModule('socialModule')` sur les routes sociales bailleur.
- Création auto des flags à la création d’un bailleur (admin).

**Variables d’environnement** (optionnelles) :

| Variable | Rôle |
|----------|------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email réel |
| `NOTIFICATIONS_EMAIL_ENABLED=false` | Désactive l’email (garde in-app + push) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | FCM |
| `GOOGLE_APPLICATION_CREDENTIALS` | Chemin JSON service account (alternative) |
| `NOTIFICATIONS_PUSH_ENABLED=false` | Désactive le push |

**Dépendances** : `nodemailer`, `firebase-admin`.

**Tests** : `npx prisma migrate deploy` OK · `npm run build` OK.

---

### Sprint D — Dashboard bailleur (stats IA + escalades)

**Commit** : `8afc7698`

**Livré** :

- **`GET /landlords/me/dashboard`** (BAILLEUR, AGENT) : KPI parc, factures, compteurs par `responsibility` et `status`, escalades actives, stats IA (confiance moyenne, catégories), derniers tickets.
- **`GET /landlords/me/tickets?responsibility=`** — filtre optionnel (agents supportés via `BailleurScope`).
- **admin-dashboard** : tableau de bord enrichi, filtres sur la liste tickets, badges responsabilité.

---

### Sprint F — Lia (conversation async + hôte d’accueil)

**Migration** : `20260515140000_lia_conversation`  
**Contexte** : le locataire peut **fermer l’app dès le 1er message** et revenir sur **push** ; pas d’attente bloquante sur l’analyse patho/juriste.

**Livré (backend)** :

- Modèles **`TicketMessage`** (rôles `TENANT`, `LIA_HOST`, `LIA_SYSTEM`), **`AiMemory`** (RAG juriste — structure prête), statut ticket **`LIA_ANALYZING`**.
- Module **`src/lia/`** : `LiaHostService` (Groq / fallback FR), `LiaOrchestratorService` (accueil synchrone + `analyzeTicket` en arrière-plan).
- **`POST /tickets`** : retourne le ticket + `messages` (accueil immédiat).
- **`GET /tickets/:id/messages`**, **`POST /tickets/:id/messages`** (locataire).
- Variables : `GROQ_API_KEY`, `LIA_HOST_MODEL`, `LIA_HOST_ENABLED` (voir `.env.example`).

**Décisions produit** :

| Sujet | Décision |
|--------|----------|
| Fermeture app après 1er message | **Oui** — push à la fin d’analyse |
| Contexte bailleur social | **2terHabitat** (fusion SIGUY/SIMKO, effetif 1er janv. 2026) — pas de références SIGUY/SIMKO dans le code |
| Agents cibles (phases suivantes) | Hôte Groq → Pathologiste Gemini → Juriste Mistral + `AiMemory` → orchestrateur NestJS |

**Livré (compléments 16 mai 2026)** :

- Push FCM : champ `ticketId` dans le payload `data` (accueil Lia + fin d’analyse).
- Anti-doublon : une seule analyse async à la fois par ticket.
- Flutter : `PushHandlerService` + `NotificationNavigation` persistante (SharedPreferences) ; `FcmService` prêt (`firebase_options.dart` — activer après `flutterfire configure`).
- Conversation : bouton « Prendre une photo » si `AWAITING_TENANT_PHOTO` → `redo-photo`.

**Suite** : FCM prod, multilingue, enrichir `AiMemory` (embeddings).

---

### Sprint G — Pathologiste + juriste (pipeline Lia)

**Contexte** : remplacer le stub mots-clés par une chaîne en 2 agents, testable en **simulation** sans vrais locataires.

**Livré (backend)** :

- **`AI_PIPELINE_MODE`** : `lia` (défaut), `stub`, ou `auto` (lia si clés API).
- **`LiaPathologistService`** : Gemini Vision si `GEMINI_API_KEY`, sinon simulation (fuite, électricité, etc.).
- **`LiaJuristService`** : Mistral + extraits `AiMemory` si `MISTRAL_API_KEY`, sinon règles + mémoire.
- **`AiPipelineLiaAdapter`** : pathologiste → juriste ; repli stub si échec.
- **`AiMemoryService`** : recherche RAG par mots-clés (bailleur + global).
- Scripts : `scripts/seed-ai-memory.ts`, `scripts/test-sprint-g.ps1`.
- Variables : voir `.env.example` (`GEMINI_*`, `MISTRAL_*`, `AI_PIPELINE_MODE`).

**Simulation locale (sans clés API)** :

```powershell
cd mon-backend/backend
npx ts-node scripts/seed-lia-demo.ts
npx ts-node scripts/seed-ai-memory.ts
# AI_PIPELINE_MODE=lia par défaut — pathologiste/juriste en mode simulation
npm run start:dev
.\scripts\test-sprint-g.ps1
```

**Avec vrais LLM** : renseigner `GEMINI_API_KEY` et/ou `MISTRAL_API_KEY`, redémarrer le serveur.

**Flutter (Sprint F — UI)** :

- `TicketConversationScreen` — fil bulles locataire / Lia, bandeau « Lia analyse… », envoi de messages, photo.
- `MyTicketsScreen` — liste `GET /tickets/me`.
- Création ticket → redirection conversation (`POST /tickets` + `messages`).
- `TenantService` — logement via `GET /tenant/me` (plus de `housingId: 1` en dur).
- FCM prod : `flutterfire configure` → `DefaultFirebaseOptions.isConfigured = true` + `google-services.json` / `GoogleService-Info.plist`.

---

## 5. Prochaines étapes suggérées (non encore codées)

| Priorité | Thème | Description |
|----------|--------|-------------|
| ~~A~~ | ~~Feature flags par bailleur~~ | **Fait** |
| ~~B~~ | ~~Notifications réelles~~ | **Fait** — prod : SMTP/FCM |
| ~~D~~ | ~~Dashboard bailleur~~ | **Fait** |
| ~~F~~ | ~~Lia / LLM (conversation)~~ | **Fait** |
| ~~G~~ | ~~Pathologiste + juriste~~ | **Fait** — Gemini/Mistral optionnels + simulation |
| C | **Multilingue + avatar 2D** | Locales + guide UX |
| E | **YouTube Data API** | Remplacer stub vidéo |
| G | **Compliance OPS / SLS** | Extension social |
| H | **Assurances / relances** | Modèles séparés |

---

## 6. Points d’attention techniques

- **Répertoire Prisma** : `mon-backend/backend` (pas `mon-backend` seul).
- **DTO bailleur (Swagger)** : `AdminUpdateLandlordDto` (admin) et `LandlordUpdateProfileDto` (bailleur `PATCH /me`) — plus de doublon `UpdateLandlordDto`.
- **Prod notifications** : modèle dans `mon-backend/backend/.env.example` (SMTP + Firebase).
- **Feature flags** : `@RequiresLandlordModule` sur les contrôleurs métier ; ADMIN plateforme non bloqué.
- **Module `artisans/`** : reste pour prestataires bailleur / planning ; distinct de **`ArtisanRequest`** (owner).
- **Transcript sessions** (historique chat) :  
  `C:\Users\ewald\.cursor\projects\c-Users-ewald-Desktop-LE-LOCATAIRE-mon-backend-backend\agent-transcripts\`

---

## 7. Comment mettre à jour ce fichier

À **chaque fin de session** avec l’assistant (ou après un sprint livré), compléter ce document dans l’ordre suivant.

### Checklist rapide

1. Mettre à jour la date en tête : **« Dernière mise à jour »**.
2. Ajouter une ligne dans le **tableau §3** (commit + sprint) si un nouveau commit a été fait.
3. Ajouter ou compléter une sous-section dans **§4** (résumé de session).
4. Ajuster **§5** (prochaines étapes) : barrer ce qui est fait, ajouter la priorité suivante.
5. Si une décision produit a changé, mettre à jour **§2**.
6. Rappeler **§0** : réponses accessibles au porteur non développeur ; explications sur demande.

### Modèle à copier pour une nouvelle session

```markdown
### Sprint N — Titre court (JJ mois AAAA)

**Commit** : `hash12`  
**Migration** : `nom_migration` (ou « aucune »)

**Contexte** : une phrase sur l’objectif.

**Livré** :
- …
- …

**Endpoints principaux** :
- `MÉTHODE /chemin` — rôle(s)

**Décisions / PRD** : (si applicable)

**Tests** : build OK / migrate deploy OK / smoke serveur OK

**Suite proposée** : …
```

### Commit Git de ce fichier seul

Depuis la racine du dépôt `LE LOCATAIRE` :

```powershell
cd "C:\Users\ewald\Desktop\LE LOCATAIRE"
git add NOTE.md
git commit -m "docs: mise à jour NOTE.md (fin de session sprint N)"
```

Ne pas committer `projet.txt` ni les fichiers Office temporaires (`~$*`).

### Historique des mises à jour de ce document

| Date | Auteur | Changement |
|------|--------|------------|
| 15 mai 2026 | Session assistant | Création initiale : synthèse sessions 0–5 + roadmap |
| 15 mai 2026 | Session assistant | Sprint 6 : notifications (SMTP/FCM) + feature flags bailleur |
| 15 mai 2026 | Session assistant | Renommage DTO Swagger : `AdminUpdateLandlordDto` / `LandlordUpdateProfileDto` |
| 15 mai 2026 | Porteur projet | §0 ajouté : porteur non développeur, explications simples attendues |
| 16 mai 2026 | Session assistant | Sprint F clôturé : push ticketId, FCM hook Flutter, photo depuis conversation |
| 16 mai 2026 | Session assistant | Sprint G : pipeline pathologiste + juriste + AiMemory RAG |
