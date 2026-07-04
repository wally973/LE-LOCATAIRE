# Rapport final — module métier logement social

Date : 2026-06-26

## Objectif

Créer un module de fiches opérationnelles pour aider l'application et l'IA à distinguer :
- parties privatives et parties communes ;
- menus travaux et travaux techniques ;
- rôles de proximité, pilotage et technique ;
- nuisances et circuits de traitement ;
- orientation vers les bons dashboards.

## Fiches créées

- `metier-parties-privatives-vs-parties-communes.md`
- `metier-role-responsable-cite.md`
- `metier-role-gardien-agent-proximite.md`
- `metier-role-technicien.md`
- `metier-menus-travaux-vs-travaux-techniques.md`
- `metier-traitement-nuisances.md`
- `metier-circuit-traitement-demandes.md`

## Résumé par fiche

### Parties privatives vs parties communes
Définit la première frontière de décision : usage exclusif du logement ou usage collectif du bâtiment/résidence. Ajoute exemples, responsabilités, interventions typiques et exploitation dashboard.

### Rôle du responsable de cité
Décrit le pilotage de proximité : marchés, prestataires, gardiens, parties communes, nuisances, menus travaux, limites et escalades vers technicien ou bailleur.

### Rôle du gardien / agent de proximité
Précise les missions terrain : accueil, surveillance, propreté, constats, incivilités, petites interventions autorisées, suivi de prestataire et limites de sécurité.

### Rôle du technicien
Cadre les interventions techniques : diagnostic, sécurité, réseaux, équipements collectifs, sinistres, travaux spécialisés, limites juridiques et coordination.

### Menus travaux vs travaux techniques
Donne la séparation opérationnelle entre petit entretien accessible et travail nécessitant diagnostic, habilitation, entreprise ou expertise technique.

### Traitement des nuisances
Classe nuisances sonores, visuelles, comportementales, olfactives, techniques et causées par un tiers. Décrit actions par acteur et procédure étape par étape.

### Circuit de traitement des demandes
Formalise le parcours réception → classification → orientation → action → suivi → clôture → capitalisation, sans imposer de modification technique aux dashboards.

## Sources web utilisées

- Union sociale pour l'habitat — Responsable de site : https://www.union-habitat.org/metiers-formations/referentiel-metiers/rechercher/metiers/responsable-de-site
- Union sociale pour l'habitat — Chargé de maintenance : https://www.union-habitat.org/metiers-formations/referentiel-metiers/rechercher/metiers/charge-de-maintenance-chargee-de
- Union sociale pour l'habitat — métiers : https://www.union-habitat.org/metiers-et-formations/les-metiers
- Union sociale pour l'habitat — traitement des réclamations : https://www.union-habitat.org/sites/default/files/articles/documents/2018-03/le%20ttt%20des%20reclamations%20points%20strategiques.pdf
- Hauts-de-Seine Habitat — Gardien d'immeubles : https://www.hautsdeseinehabitat.fr/nos-offres-d-emploi/gardien-dimmeubles-hf
- Est Métropole Habitat — Gardien d'immeuble : https://www.est-metropole-habitat.fr/offres-emploi/gardien-dimmeuble-f-h-2/
- Hauts-de-Bièvre Habitat — signaler un dysfonctionnement : https://www.hdb-habitat.fr/comment-signaler-un-dysfonctionnement-dans-votre-logement/
- ANIL réparations : https://www.anil.org/parole-expert-logement-locataire-qui-paie-les-reparations/
- ANIL obligations locataire : https://www.anil.org/votre-besoin/louer/type-de-location/location-vide/droits-et-obligations/
- ANIL charges : https://www.anil.org/votre-besoin/louer/type-de-location/location-vide/charges/
- ANIL nuisances en copropriété : https://www.anil.org/parole-expert-logement-nuisance-voisin-coproprietaire/
- Service-Public réparations locatives : https://www.service-public.fr/particuliers/vosdroits/F31697
- Service-Public logement décent : https://www.service-public.fr/particuliers/vosdroits/F2042
- Service-Public bruits de voisinage : https://www.service-public.fr/particuliers/vosdroits/F612
- Service-Public nuisances olfactives : https://www.service-public.fr/particuliers/vosdroits/F19299

## Exploitabilité dashboards

### Dashboard locataire
- Questions simples : commun ou privatif, danger ou non, nuisance ou technique.
- Statuts compréhensibles : constat gardien, traitement responsable de cité, ticket technicien, recours ou assurance.
- Consignes utiles sans jargon.

### Dashboard responsable de cité
- File des parties communes, menus travaux, nuisances, prestataires et relances.
- Contrôle des marchés : nettoyage, espaces verts, sécurité, encombrants.
- Suivi des escalades vers technicien ou bailleur.

### Dashboard gardien / agent de proximité
- Constats terrain, photos, petites interventions, signalements, suivi de passage prestataire.
- Règles de limite : danger, violence, technique lourde, entrée dans le logement.

### Dashboard technicien
- Tickets techniques qualifiés : réseau, sécurité, structure, équipement collectif, sinistre.
- Diagnostic, pièces, accès, urgence, corps d'état, compte rendu.

### Dashboard bailleur / admin
- Pilotage global : coûts, récurrences, délais, prestataires, contentieux potentiels.
- Distinction claire entre proximité, technique, juridique et assurance.

## Cohérence avec la bibliothèque existante

Les fiches créées ne recopient pas les textes juridiques existants.
Elles renvoient logiquement vers :
- `loi-89-462-6-juillet-1989-articles-locatifs.md`
- `code-civil-articles-1719-a-1725-bail.md`
- `decret-87-712-26-aout-1987-reparations-locatives.md`
- `decret-2016-382-30-mars-2016-vetuste-etat-des-lieux.md`
- `nuisances-sonores-bruits-voisinage.md`
- `nuisances-visuelles-trouble-anormal-voisinage.md`
- `nuisances-tiers-locataire-bailleur.md`
- `recours-officiels-logement-voisinage.md`
- `assurances-habitation-sinistres-recours.md`
- `normes-techniques-logement-electricite-gaz-ventilation-incendie.md`

## Statut final

Le module métier est prêt pour alimenter :
- la qualification IA ;
- les circuits de traitement ;
- l'affichage des dashboards ;
- les synthèses locataire, responsable de cité, gardien, technicien et bailleur.

Point de vigilance : ces fiches sont opérationnelles et ne remplacent pas les procédures internes propres à chaque bailleur.
