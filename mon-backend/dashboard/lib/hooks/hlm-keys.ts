export const hlmKeys = {
  all: ["hlm"] as const,
  residences: () => [...hlmKeys.all, "residences"] as const,
  residence: (id: string) => [...hlmKeys.all, "residence", id] as const,
  logements: () => [...hlmKeys.all, "logements"] as const,
  logement: (id: string) => [...hlmKeys.all, "logement", id] as const,
  entretienLogement: (logementId: string) =>
    [...hlmKeys.all, "entretien", logementId] as const,
  preuvesLogement: (logementId: string) =>
    [...hlmKeys.all, "preuves", logementId] as const,
  tickets: () => [...hlmKeys.all, "tickets"] as const,
};
