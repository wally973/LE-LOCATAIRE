# TRADES_CULTURE — Culture métier Jarvis (Niveau 5)

> Ce document n’est pas une liste de règles à obéir aveuglément.  
> C’est la **mécanique du bâtiment** que Lia doit *comprendre* pour cesser de « se battre avec le volant » en intake.

L’équipe (Archiviste, Diagnostiqueur, Majordome) partage la même physique. Le LLM ne « lit » pas des interdictions JSON : il **sent** pourquoi une consigne existe.

---

## 1. Principe directeur — Forces, pas lots

Un **lot** (ÉLECTRICITÉ, PLOMBERIE…) est un classement administratif.  
Une **force** est ce qui **pousse** le bâtiment et le locataire : pression, pente, courant, dilatation, contrainte humaine.

| Force dominante | Corps d’état | Question métier |
|-----------------|--------------|-----------------|
| Courant / arc / chaleur localisée | Électricité | Où l’énergie se dissipe-t-elle anormalement ? |
| Pression amont / pente aval | Plomberie | L’eau fuit-elle sous pression ou refoule-t-elle faute de pente ? |
| Pivot / dilatation / alignement | Menuiserie | La porte bouge-t-elle sur ses gonds ou le cadre a-t-il migré ? |
| Mobilité / vulnérabilité | Humain (donnée physique) | Qui ne peut pas attendre, se baisser, couper le courant seul ? |

**Annulation d’inertie** : quand une force devient **critique** (incendie imminent, refoulement, personne enfermée) ou que l’Archiviste a une **certitude juridique** claire, le Majordome **accélère** — il ne prolonge pas le questionnaire par habitude.

---

## 2. Électricité — Force invisible

L’électricité n’est **pas** un « lot ampoules ». C’est une **énergie** qui cherche la moindre résistance.

### Signaux qui annulent tout autre procédure

- **Grésillement**, **crépitement**, **étincelles** à une prise ou un interrupteur  
- **Odeur de brûlé**, **noircissement**, **chaleur anormale** sur appareillage fixe  
- **Disjoncteur** qui saute à répétition sans cause d’usage évidente  

Ces signaux ne sont pas des « détails à compléter » : ce sont des **précurseurs d’incendie**.  
Le bruit *est* le diagnostic. Poser « avez-vous changé l’ampoule ? » sur une **prise murale** est une erreur de modèle mental : l’ampoule est un consommable d’**éclairage** ; la prise est une **liaison fixe** sous tension.

### Modèles mentaux autorisés

- Distribution — circuit, liaison prise, bornes, disjoncteur divisionnaire  
- Surchauffe localisée — mauvais contact, oxydation, surcharge multiprise  
- Installation vétuste — responsabilité à trancher **après** mise en sécurité  

### Modèles **interdits** sur force électrique

- Exutoire, dalle froide, refoulement EU — vocabulaire **hydraulique**  
- Ampoule, douille, lustre — vocabulaire **éclairage** sauf si le signalement porte explicitement sur un luminaire  

### Consigne Majordome (arc / grésillement) — séquence en 3 temps

1. **BOUCLIER (priorité d’affichage)** : l’`acknowledgment` **commence** par éloignement, puis **disjoncteur avant tout contact** sur la prise, puis débranchement si besoin — jamais une question avant.
2. **ENQUÊTE CHIRURGICALE** : une seule question sur ce que le locataire **n’a pas** dit (eau près de la prise en buanderie, multiprise surchargée) — **interdit** de redemander odeur / brûlé / étincelles déjà signalés.
3. **TICKET BAILLEUR** : synthèse du type *« Urgence incendie : utilisateur mis en sécurité. Diagnostic suspecté : surcharge multiprise ou humidité… »* dans `extractedFacts.synthese_ticket_bailleur`.

---

## 3. Plomberie — Pression (amont) et pente (aval)

L’eau obéit à deux logiques distinctes :

### Amont — Pression / étanchéité

Robinet, flexible, joint, groupe de sécurité, **puisage** (= point d’usage, pas « passage »).  
La fuite apparaît **sous pression** ou **au repos** si le joint ne tient plus.

### Aval — Exutoire / pente / gravité

Siphon, bonde, colonne EU/EP, pente de chute.  
Le **refoulement** (eau sale qui remonte, évier plein) signale un **aval bouché** — ce n’est pas une simple fuite de joint.

**Règle des trois verres** : avant d’accuser l’intérieur, vérifier que l’**exutoire** (sortie) est libre.

### Tournant d’urgence plomberie

Inondation, eaux usées qui débordent, cuisine/lavabo plein d’eau sale → **hydrocureur / plombier urgent**, pas questionnaire sur le timing du robinet.

---

## 4. Menuiserie — Pivots et dilatations

Une porte est un **levier** sur gonds. Elle coince si :

- Les **gonds affaissent** (porta frotte le sol)  
- Le **cadre gonfle** (humidité chronique, infiltration lente)  
- La **gâche** n’est plus en face du pêne  

**Clé perdue** ≠ **serrure vétuste** : le premier est souvent charge locataire (accès) ; le second peut relever du bailleur.

### Tournant sécurité

Enfant enfermé, personne bloquée, logement impossible à sécuriser → **serrurier prioritaire**, pas simulation lente de dilatation.

---

## 5. L’humain — Contrainte physique du dossier

Le locataire n’est pas un champ texte :

- **Âge, mobilité, handicap** → ne pas demander d’actions dangereuses (tableau électrique haut, crawlspace)  
- **Détresse financière** → l’Archiviste a tranché ; le Majordome **ne promet pas** le gratuit bailleur  
- **Urgence vécue** (« depuis hier », « toute la nuit ») → accélère la prise au sérieux  

---

## 6. Synchronisation par l’intention (collègues de terrain)

Quand le **Diagnostiqueur** signale un arc électrique, le Majordome comprend :

> « Mon collègue vient de voir de la chaleur dans une liaison fixe — je n’ai pas le droit de faire semblant que c’est une ampoule. »

Quand l’**Archiviste** dit charge locataire (87-712, clés perdues) :

> « La loi est claire — je n’ai pas à poser dix questions pour éviter de la dire. »

Les **interdictions** du brief (pas d’exutoire, pas d’ampoule) sont des **conséquences physiques**, pas du caprice administratif.

---

## 7. Cinétique de décision — Safety Override

| Priorité | Déclencheur | Comportement Majordome |
|----------|-------------|------------------------|
| **Critique** | Arc, grésillement, odeur brûlé, refoulement EU, inondation | Consigne sécurité **immédiate**, `nextQuestion` null sauf sécurité, handoff / clôture |
| **Haute** | Personne enfermée, fuite majeure, incendie structurel | Urgence bailleur, pas questionnaire discriminant hors sécurité |
| **Juridique certaine** | Archiviste LOCATAIRE + scénario charge identifié (ouverture) | Vérité légale d’abord, pas fausse promesse technicien |
| **Routine** | Cas simple discriminable | Une question utile max, puis clôture si preuves suffisantes |

**Inertie interdite** : si la force diagnostique est **critique**, le système ne doit **pas** retomber sur `pickJarvisDiscriminatingQuestion` par défaut.

---

## 8. Références croisées

- `VISUAL_LOGIC.md` — scène 3D, exutoire, dalle, enveloppe  
- `MISSION_JARVIS.md` — double numérique expert terrain  
- `knowledge/master-diagnostic-rules.json` — hypothèses différentielles  
- `data/legal-references.json` — Archiviste  
