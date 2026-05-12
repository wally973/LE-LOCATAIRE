"use client";

import Link from "next/link";
import { computeWarrantyDates } from "@/lib/warranty/compute-dates";
import { TicketStatsChart } from "@/components/charts/ticket-stats-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useHlmResidences } from "@/lib/hooks/use-hlm-queries";

export default function BailleurDashboardPage() {
  const { data: residences = [], isPending, error } = useHlmResidences();
  const first = residences[0];
  const warranty = first ? computeWarrantyDates(first) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Pilotage parc</h1>
        <p className="text-muted-foreground">
          Synthèse des résidences critiques, exposition des garanties et suivi du
          dispositif d’obligation locataire.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur API</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {isPending
                ? "Chargement résidence…"
                : first
                  ? `Résidence ${first.name}`
                  : "Aucune résidence"}
            </CardTitle>
            <CardDescription>
              Indicateurs garanties automatiques après saisie de la livraison (
              <code className="rounded bg-muted px-1">GET /hlm/residences</code>
              ).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!first || !warranty ? (
              <p className="text-muted-foreground">
                Ajoutez une résidence pour afficher les jalons GPA / biennale /
                décennale.
              </p>
            ) : (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Fin GPA (+1 an)</span>
                  <Badge>{warranty.gpaEndDate}</Badge>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Fin biennale (+2 ans)</span>
                  <Badge variant="outline">{warranty.biennaleEndDate}</Badge>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Fin décennale (+10 ans)</span>
                  <Badge variant="secondary">{warranty.decennaleEndDate}</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-0">
            <CardTitle>Volumétrie interventions</CardTitle>
            <CardDescription>Stub graphique interactif.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-6">
            <TicketStatsChart />
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/bailleur/residences/nouvelle">Ajouter résidence</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/bailleur/entretien-locataire">Suivi entretiens</Link>
        </Button>
      </div>
    </div>
  );
}
