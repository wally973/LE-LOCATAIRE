"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MaintenanceLegalNotice } from "@/components/maintenance/maintenance-legal-notice";
import { MaintenanceRemindersBoard } from "./reminders-board";
import { shouldBlockTicket } from "@/lib/validations/ticket-guard";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getTenantLogementId,
  useHlmLogementEntretien,
  useHlmTickets,
} from "@/lib/hooks/use-hlm-queries";

export default function LocataireDashboardPage() {
  const logementId = getTenantLogementId();
  const { data: plans = [], isPending: plansLoading, error: plansErr } =
    useHlmLogementEntretien(logementId);
  const { data: tickets = [], isPending: tkLoading, error: tkErr } =
    useHlmTickets();

  const recentProof = new Date(Date.now() - 10 * 86400000).toISOString();
  const gate = shouldBlockTicket(
    {
      proofsValid: true,
      photosCoherent: true,
      lastCompleteProofAt: recentProof,
      outdoorProofsCompliant: false,
    },
    "INFILTRATION",
  );

  const firstProofHref =
    plans[0]?.id != null
      ? `/locataire/entretien/preuves/${plans[0].id}`
      : undefined;

  const envMissing = !process.env.NEXT_PUBLIC_API_URL;
  const logementMissing = !logementId;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Synthèse</h1>
        <p className="text-muted-foreground">
          Rappels automatiques d’entretiens, exposition des garanties résidence et
          contrôle des tickets lorsque vos preuves externes ne sont pas à jour.
        </p>
      </div>

      {envMissing ? (
        <Alert variant="destructive">
          <AlertTitle>Configuration</AlertTitle>
          <AlertDescription>
            Définissez <code className="rounded bg-muted px-1">NEXT_PUBLIC_API_URL</code>{" "}
            (URL du backend NestJS, sans slash final).
          </AlertDescription>
        </Alert>
      ) : null}
      {logementMissing ? (
        <Alert>
          <AlertTitle>Logement locataire</AlertTitle>
          <AlertDescription>
            Ajoutez{" "}
            <code className="rounded bg-muted px-1">
              NEXT_PUBLIC_HLM_LOGEMENT_ID
            </code>{" "}
            (UUID du logement) dans{" "}
            <code className="rounded bg-muted px-1">.env.local</code> pour charger
            les échéances via l’API HLM.
          </AlertDescription>
        </Alert>
      ) : null}

      {(plansErr || tkErr) && (
        <Alert variant="destructive">
          <AlertTitle>Erreur API</AlertTitle>
          <AlertDescription>
            {(plansErr ?? tkErr)?.message ??
              "Impossible de joindre le backend — vérifiez le JWT dans localStorage."}
          </AlertDescription>
        </Alert>
      )}

      <MaintenanceLegalNotice />
      {plansLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des échéances…</p>
      ) : (
        <MaintenanceRemindersBoard plans={plans} proofHref={firstProofHref} />
      )}
      <Separator />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Contrôle tickets</CardTitle>
            <CardDescription>
              Module 4 — blocage lorsque les preuves ne correspondent pas aux
              catégories incident.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={gate.blocked ? "destructive" : "outline"}>
              {gate.blocked ? "Ticket bloqué" : "Ouverture permise"}
            </Badge>
            {gate.reason ? (
              <p className="text-xs text-muted-foreground">Motif : {gate.reason}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Exemple litige évitables</CardTitle>
            <CardDescription>
              {tkLoading
                ? "Chargement…"
                : tickets[0]?.title ?? "Aucun ticket pour le moment"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Les problématiques nuisibles, infiltations côté privatif,
              évacuations nécessitent un historique complet d’entretien
              extérieur.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/locataire/entretien">Programme d’entretien</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/locataire/tickets/nouveau">Nouveau ticket (simulation)</Link>
        </Button>
      </div>
    </div>
  );
}
