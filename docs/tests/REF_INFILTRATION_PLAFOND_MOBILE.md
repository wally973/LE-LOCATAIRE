# Cas de référence — REF_INFILTRATION_PLAFOND_MOBILE

> **Standard mobile Grock** — Pipeline head-input T1→T5, infiltration plafond.

**ID :** `REF_INFILTRATION_PLAFOND_MOBILE`  
**Fixture :** `src/grock/fixtures/infiltration-plafond-mobile.fixture.ts`  
**Régression Jest :** `infiltration-plafond-mobile.regression.spec.ts` + `head-input/`  
**E2E HTTP :** `scripts/test-mobile-grock-photo.ts`

---

## Architecture

| Couche | Rôle |
|--------|------|
| **Couche 0** | normalisation, perception, signalement, signalQuality — **sans métier sinistre** |
| **Tête 1** | faits (eau, plafond, traces, luminaire, étage, photo) |
| **Tête 2** | dangerFlags, cohérence texte ↔ image |
| **Tête 3** | scores hypothèses (infiltration, voisin, toiture, dégât des eaux, condensation, sinistre_probable) |
| **Tête 4** | sinistre_candidat, états, doctrine assurance, **IRSI/recours** |
| **Tête 5** | thèmes parole + garde-fou léger |

---

## Test gouttes d’eau au plafond — attendu

| Tête | Attendu |
|------|---------|
| T3 | `infiltration_score` ≥ 8, `sinistre_probable` = true |
| T4 | `sinistre_candidat`, `ASK_ONE_QUESTION` si origine mixte |
| T5 | thèmes sécurité, photos, assurance 5 j, prévenir voisin |
| Parole | sinistre + IRSI + sécurité + prévenir voisin du dessus |

---

## Lancer

```powershell
cd mon-backend/backend
npx jest infiltration-plafond-mobile head-input
npx ts-node --transpile-only scripts/test-mobile-grock-photo.ts
```
