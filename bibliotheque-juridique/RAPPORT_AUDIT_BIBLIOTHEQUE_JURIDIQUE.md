# Rapport d'audit — bibliothèque juridique

Date : 2026-06-21

## Périmètre audité

Dossier demandé : `bibliotheque-juridique/`

Statut initial : aucun fichier trouvé dans ce dossier avant enrichissement.

Documents juridiques déjà présents ailleurs dans le projet :
- `data/legal-references.json` : loi du 6 juillet 1989, décret 87-712, décret 87-713, Code civil 1719 et 1721, logement décent, Service-Public réparations/travaux/dégradations.
- `mobile/flutter/assets/legal/legal_references.json` : copie mobile de la base juridique.
- `data/installations-charges-vetuste.json` : matrice métier réparations locatives / vétusté avec références 87-712, 2016-382, Service-Public F21105.
- `data/lia-juridique-savoir.json` et `data/lia-jarvis-entrainement-juridique.json` : savoir juridique d'entraînement et scénarios de contrôle.

## Documents demandés et statut

1. Loi du 6 juillet 1989 — présent partiellement dans `data/legal-references.json`, fiche autonome créée.
2. Code civil articles 1719 à 1725 — présent partiellement (1719, 1721), fiche autonome créée pour 1719 à 1725.
3. Décret n°87-712 réparations locatives — présent partiellement, fiche autonome créée.
4. Décret n°2016-382 vétusté — présent dans matrice métier, fiche autonome créée.
5. Décret n°2015-981 mobilier meublé — non trouvé dans la bibliothèque existante, fiche créée.
6. Service-Public dégradations locatives — présent partiellement, fiche autonome créée.
7. Service-Public location meublée — non trouvé comme fiche autonome, fiche créée.
8. Service-Public état des lieux — non trouvé comme fiche autonome, fiche créée.
9. ANIL dégradations / vétusté / meublé-non meublé — non trouvé comme fiche autonome, fiches créées.
10. CCH partie DOM / Guyane — non trouvé comme fiche autonome, fiche créée.
11. Ordonnance n°2000-373 du 26 avril 2000 — référence logement non validée ; fiche de contrôle créée avec alerte qualité.
12. Décrets CAF / ANAH / LADOM aides logement — dossier large non stabilisé ; fiche de cadrage créée avec sources CCH / allocation logement et alerte LADOM.

## Documents créés

- `loi-89-462-6-juillet-1989-articles-locatifs.md`
- `code-civil-articles-1719-a-1725-bail.md`
- `decret-87-712-26-aout-1987-reparations-locatives.md`
- `decret-2016-382-30-mars-2016-vetuste-etat-des-lieux.md`
- `decret-2015-981-31-juillet-2015-mobilier-logement-meuble.md`
- `service-public-degradations-locatives.md`
- `service-public-location-meublee.md`
- `service-public-etat-des-lieux.md`
- `anil-degradations-vetuste-reparations.md`
- `anil-location-meublee-non-meublee.md`
- `code-construction-habitation-dom-guyane.md`
- `outre-mer-logement-reference-2000.md`
- `aides-logement-caf-anah-ladom-dom.md`

## Sources officielles principales

- Légifrance — loi 89-462 : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000509310/
- Légifrance — Code civil bail : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070721/LEGISCTA000006150285/
- Légifrance — décret 87-712 : https://www.legifrance.gouv.fr/eli/decret/1987/8/26/87-712/jo/texte
- Légifrance — décret 2016-382 : https://www.legifrance.gouv.fr/eli/decret/2016/3/30/2016-382/jo/texte
- Légifrance — décret 2015-981 : https://www.legifrance.gouv.fr/eli/decret/2015/7/31/2015-981/jo/texte
- Service-Public — dégradations : https://www.service-public.fr/particuliers/vosdroits/F21105
- Service-Public — location meublée : https://www.service-public.fr/particuliers/vosdroits/F34769
- Service-Public — état des lieux entrée : https://www.service-public.fr/particuliers/vosdroits/F31270
- Service-Public — état des lieux sortie : https://www.service-public.fr/particuliers/vosdroits/F33671
- ANIL — réparations : https://www.anil.org/parole-expert-logement-locataire-qui-paie-les-reparations/
- ANIL — vétusté : https://www.anil.org/documentation-experte/analyses-juridiques-jurisprudence/analyses-juridiques/analyses-juridiques-2016/modalite-detablissement-de-letat-des-lieux-et-prise-en-compte-de-la-vetuste/
- ANIL — meublé : https://www.anil.org/votre-besoin/louer/type-de-location/location-meublee/bail/
- Légifrance — CCH DOM : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006074096/LEGISCTA000006145312/2016-06-01/

## Statut final

Bibliothèque juridique créée et enrichie avec des fiches Markdown officielles ou institutionnelles.

Point de vigilance :
- La référence « ordonnance n°2000-373 du 26 avril 2000 — adaptation du droit du logement outre-mer » ne doit pas être utilisée comme source logement tant qu'elle n'est pas corrigée.
- Le bloc CAF / ANAH / LADOM doit être précisé par cas d'usage : APL locataire, amélioration ANAH, mobilité LADOM, logement social DOM.
