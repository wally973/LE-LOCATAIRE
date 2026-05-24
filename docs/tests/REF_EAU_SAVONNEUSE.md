# Cas de référence — REF_EAU_SAVONNEUSE (Golden Dataset)

> **Standard de qualité** — Ceci est notre Standard de Qualité. Tout futur diagnostic doit atteindre ce niveau de précision et de rigueur logique.

**ID :** `REF_EAU_SAVONNEUSE`  
**Agent :** Diagnostic (3ᵉ maillon Savoir-Voir)  
**Corpus :** AFPOLS C0237, AQC B.01 / REX humidité  
**Stack technique :** `DiagnosticState.sensors` dans `mon-backend/backend/src/lia/` (équivalent des « tiroirs » demandés ; pas de `schema.py` dans ce dépôt).

---

## Données d’entrée (signalement locataire)

| Champ | Valeur |
|--------|--------|
| Lieu | Salon, **centre de la pièce**, loin des menuiseries ; logement **R+1**, résidence collective, **Cayenne** |
| Saison | **Saison sèche** — aucune pluie depuis 3 semaines |
| Constat | Flaque d’eau au sol |
| Contexte annexe | Climatisation en panne et éteinte depuis 1 semaine |
| **Fait crucial** | Eau **légèrement savonneuse / mousseuse** ; apparition **uniquement 19 h – 21 h** |

**Capteurs attendus (`DiagnosticState.sensors`) :**

| Capteur | Valeur attendue |
|---------|-----------------|
| `water_aspect` | `savonneuse/mousseuse` |
| `timing_pattern` | `19h-21h` |
| `building_floor` | `R+1` |
| `weather_context` | `Saison sèche` |

---

## Réponse agent Diagnostic (référence)

### 1. Observation (faits retenus, sans interprétation)

| Canal | Fait |
|--------|------|
| **Lieu** | Salon, **centre de la pièce**, loin des menuiseries ; logement en **R+1**, résidence collective, **Cayenne**. |
| **Saison** | **Saison sèche** — **aucune pluie depuis 3 semaines**. |
| **Eau** | Flaque au **sol** ; eau **légèrement savonneuse / mousseuse**. |
| **Temporalité** | Apparition **uniquement 19 h – 21 h** (créneau reproductible). |
| **Contexte annexe** | Climatisation **en panne et éteinte depuis 1 semaine** (signal faible pour la condensation active). |

**Signes cliniques dominants :** texture/odeur implicite **savon** ; pattern **horaire** ; localisation **plancher, point bas apparent** ; **absence** de corrélation pluie / façade / plafond.

---

### 2. Élimination — les 4 hypothèses classiques

#### A. Remontée capillaire (AQC B.01)

**Pourquoi logiquement impossible ici :**

- Mécanisme **continu ou saisonnier** lié au sol / fondations (franges en pied de mur, salpêtre, efflorescences minérales). Il ne s’**active pas** sur un créneau de 2 h en soirée.
- Signature **murale basse** (plinthes, jonction mur–dalle), pas une **flaque isolée au milieu du salon**.
- L’eau capillaire est **minérale**, pas **savonneuse** : pas de tensioactifs, pas de mousse domestique.
- Saison sèche prolongée **désamorce** la hausse de nappe / sol saturé — contexte Guyane sec, incompatible avec une remontée capillaire **aiguë et horodatée**.

→ **Écartée.**

#### B. Condensation liée à la climatisation

**Pourquoi logiquement impossible ici :**

- Condensation sur batterie froide **exige un échangeur froid actif** + écart de température. Clim **éteinte depuis 7 jours** : **aucune source froide** en production de condensats.
- La condensation donne une eau **quasi pure** (distillat de vapeur d’air) : **pas de mousse savonneuse**.
- Elle se fixe sur **parois froides** (angles, vitrages, retours d’air), pas une **flaque centrale au sol** loin des ponts thermiques.
- Le motif **19 h – 21 h seulement** n’est pas celui d’un régime de condensation d’usage (persistant la nuit, coins humides, buée).

→ **Écartée.** (La panne de clim est un **leurre** dans ce cas.)

#### C. Fuite de toiture / infiltration pluie

**Pourquoi logiquement impossible ici :**

- **3 semaines sans pluie** : pas d’alimentation météo pour une infiltration de couverture ou de façade.
- Une infiltration descendante se lit au **plafond**, **haut de mur**, **auréole sous toiture** — pas une nappe **au centre du plancher** du salon.
- Eau de pluie **non savonneuse** (sauf pollution extérieure atypique, non décrite).
- Le créneau **19 h – 21 h** n’a **aucun lien causal** avec un défaut d’étanchéité de toiture.

→ **Écartée.**

#### D. Fuite de canalisation encastrée (eau potable / réseau sous dalle, fuite « classique »)

**Pourquoi logiquement impossible dans ce contexte précis :**

- Fuite d’**eau sous pression** : eau **claire**, fuite **dès qu’il y a pression** (ou permanente), **sans mousse** et **sans horaire collectif.
- Une fuite EU simple tend vers un écoulement **plus continu** ou lié à **l’usage local immédiat**, pas un pic **imputable à tout l’immeuble** entre 19 h et 21 h.
- Le **savon / mousse** oriente vers des **eaux usées ou eaux vannes chargées en tensioactifs**, pas vers l’eau froide sanitaire.
- La flaque **au milieu du salon** évoque un **point bas hydraulique** ou une **remontée par un ouvrage de sol**, pas une suintation linéaire le long d’un mur cuisine.

→ L’hypothèse « fuite encastrée » au sens **alimentation** est **écartée**.  
→ Elle **masque** la vraie famille : **dysfonctionnement du réseau d’évacuation**.

---

### 3. Hypothèse finale retenue

**Refoulement intermittent d’eaux usées (EU) sur le réseau collectif d’évacuation — remontée au point bas du logement (R+1).**

**Mécanisme :**

1. En **19 h – 21 h**, pic de débits EU dans l’immeuble (douches, vaisselle).
2. Réseau saturé (colmatage, pente insuffisante, ventilation primaire défaillante) → refoulement.
3. Eau chargée en tensioactifs **refoule** vers le point de moindre résistance (siphon de sol, pénétration de dalle, défaut EU sous carrelage).
4. Le **salon au centre** = **point bas hydraulique** visible.

**Charge (indication) :** réseau collectif / évacuation → **bailleur** (à confirmer terrain).

**Preuves terrain à demander :** odeur égout, autres logements touchés le soir, bruits de colonne, corrélation 19 h–21 h.

---

## Critères d’acceptation automatisés

- `extractDiagnosticSensors()` remplit les 4 capteurs sur le texte de référence ci-dessus.
- `buildDiagnosticState({ category: 'HUMIDITY', ... })` place `hyp_refoulement_eu` en tête.
- Intake : si signalement « eau au sol », Lia pose **aspect de l’eau** et **horaires d’apparition** avant la photo.

---

*Dernière mise à jour : mai 2026*
