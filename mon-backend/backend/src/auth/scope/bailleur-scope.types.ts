/**
 * Portée multi-tenant calculée à partir du JWT utilisateur courant.
 *
 * - `isAdmin = true` : l'utilisateur a le rôle ADMIN, il n'est limité par aucun bailleur.
 *   Dans ce cas `landlordProfileId` n'est pas renseigné et les services ne doivent
 *   appliquer aucun filtre `where landlordProfileId = …`.
 *
 * - `landlordProfileId` (BAILLEUR ou AGENT) : identifiant du bailleur dont l'utilisateur
 *   peut voir / écrire les données. Tout service multi-tenant DOIT filtrer ses requêtes
 *   par cet identifiant.
 *
 * - `agenceId` (AGENT uniquement, optionnel) : si l'agent est rattaché à une agence
 *   spécifique, on peut restreindre encore davantage (ex. liste tickets de cette agence).
 *
 * - `tenantProfileId` (LOCATAIRE) : profil locataire courant. Permet de filtrer les
 *   ressources visibles par le locataire (ses contrats, ses paiements, ses tickets).
 */
export interface BailleurScope {
  isAdmin: boolean;
  landlordProfileId?: number;
  agenceId?: number | null;
  tenantProfileId?: number;
  /** Rôle brut du JWT (pour diagnostics / logs). */
  role: string;
  /** Identifiant utilisateur du JWT. */
  userId: number;
}
