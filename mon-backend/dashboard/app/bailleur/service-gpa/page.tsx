"use client";

import { computeWarrantyDates } from "@/lib/warranty/compute-dates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useHlmResidences } from "@/lib/hooks/use-hlm-queries";

export default function GPAServicePage() {
  const { data: residences = [], isPending, error } = useHlmResidences();
  const first = residences[0];
  const w = first ? computeWarrantyDates(first) : null;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Erreur API</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (isPending || !first || !w) {
    return (
      <p className="mx-auto max-w-3xl text-sm text-muted-foreground">
        Chargement du contexte résidence…
      </p>
    );
  }

  if (!first.hasInternalGPAService) {
    return (
      <Alert>
        <AlertTitle>Service désactivé</AlertTitle>
        <AlertDescription>
          Activez-le au niveau patrimoine pour router automatiquement vers vos
          experts internes jusqu’à {w.gpaEndDate}.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Service GPA</h1>
        <p className="text-muted-foreground">
          Périodes actives : jusqu’à {w.gpaEndDate}. Flux tickets à rediriger sur
          votre file interne SLA.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gouvernance</CardTitle>
          <CardDescription>
            Tableau SLA, planning visites chantier vs promesses acheteurs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary">Exporter dossier GPA CSV</Button>
          <p className="text-sm text-muted-foreground">
            Branchez ce module aux webhooks Slack / Teams utilisés chez vos
            directions techniques régionales.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
