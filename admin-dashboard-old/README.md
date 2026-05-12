# Le Locataire - Admin Dashboard

Un tableau de bord d'administration complet pour gérer les admins, bailleurs, locataires et logements de la plateforme Le Locataire.

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env.local` à la racine du projet:

```env
REACT_APP_API_URL=http://localhost:3000
```

## Démarrage

```bash
npm start
```

Le dashboard sera accessible sur `http://localhost:3001`.

## Fonctionnalités

- **Tableau de bord**: Vue d'ensemble des statistiques globales
- **Gestion des Admins**: Créer, afficher, modifier et supprimer les administrateurs
- **Gestion des Bailleurs**: Créer, afficher, modifier et supprimer les bailleurs
- **Détails Bailleurs**: Voir tous les logements d'un bailleur
- **Statistiques**: Statistiques détaillées avec calculs de taux et moyennes

## Structure du Projet

```
admin-dashboard/
├── src/
│   ├── components/       # Composants réutilisables
│   ├── pages/           # Pages principales
│   ├── services/        # Services API et authentification
│   ├── App.tsx          # Application principale
│   ├── App.css          # Styles globaux
│   └── main.tsx         # Point d'entrée
├── index.html           # HTML principal
├── package.json         # Dépendances
└── tsconfig.json        # Configuration TypeScript
```

## API Endpoints

- `POST /admin/admins` - Créer un admin
- `GET /admin/admins` - Lister tous les admins
- `GET /admin/admins/:id` - Récupérer un admin
- `PATCH /admin/admins/:id` - Modifier un admin
- `DELETE /admin/admins/:id` - Supprimer un admin
- `POST /admin/landlords` - Créer un bailleur
- `GET /admin/landlords` - Lister tous les bailleurs
- `GET /admin/landlords/:id` - Récupérer un bailleur avec ses logements
- `PATCH /admin/landlords/:id` - Modifier un bailleur
- `DELETE /admin/landlords/:id` - Supprimer un bailleur
- `GET /admin/stats` - Récupérer les statistiques globales
- `GET /admin/dashboard` - Récupérer les données du dashboard

## Authentification

Le dashboard utilise l'authentification JWT. Les tokens sont stockés localement et envoyés automatiquement avec chaque requête.

## Styles

Le projet utilise CSS pur pour le styling. Tous les styles sont contenus dans les fichiers `.css` correspondants.
