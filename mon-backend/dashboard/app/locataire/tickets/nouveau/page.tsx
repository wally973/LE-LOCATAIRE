"use client";

import { useState } from "react";
import Link from "next/link";
import { shouldBlockTicket } from "@/lib/validations/ticket-guard";
import { TICKET_BLOCKED_MAINTENANCE_FR } from "@/lib/legal/maintenance-copy";
import { suggestTicketRouting } from "@/lib/routing/ticket-route";
import type { TicketCategoryHint } from "@/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getTenantLogementId,
  useHlmCreateTicket,
  useHlmLogement,
  useHlmResidence,
} from "@/lib/hooks/use-hlm-queries";

const categories: TicketCategoryHint[] = [
  "MOUSTIQUES",
  "NUISIBLE",
  "EVACUATION",
  "INFILTRATION",
  "ODEUR",
  "AUTRE",
];

export default function NouveauTicketPage() {
  const logementId = getTenantLogementId();
  const { data: logement, isPending: lgPending, error: lgErr } =
    useHlmLogement(logementId);
  const residenceId = logement?.residenceReference;
  const { data: residence, error: resErr } = useHlmResidence(residenceId);

  const createTicket = useHlmCreateTicket();

  const [category, setCategory] = useState<TicketCategoryHint>("AUTRE");
  const [simulateProofs, setSimulateProofs] = useState("false");
  const [title, setTitle] = useState("Signalement incident locatif");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const incidentDate = new Date().toISOString().slice(0, 10);

  const gate = shouldBlockTicket(
    {
      proofsValid: simulateProofs === "true",
      photosCoherent: simulateProofs === "true",
      lastCompleteProofAt:
        simulateProofs === "true"
          ? new Date().toISOString()
          : new Date(Date.now() - 200 * 86400000).toISOString(),
      outdoorProofsCompliant: simulateProofs === "true",
    },
    category,
  );

  const routing =
    residence != null
      ? suggestTicketRouting(residence, new Date().toISOString())
      : null;

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const apiErr = lgErr ?? resErr;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Nouveau ticket</h1>
        <p className="text-muted-foreground">
          Étape combinée garanties + blocage lorsque vos preuves ne couvrent pas
          la zone impactée par l’incident.
        </p>
      </div>

      {!logementId ? (
        <Alert>
          <AlertTitle>Configuration</AlertTitle>
          <AlertDescription>
            Définissez{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_HLM_LOGEMENT_ID</code>{" "}
            pour charger la résidence via l’API.
          </AlertDescription>
        </Alert>
      ) : null}

      {apiErr ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur chargement contexte</AlertTitle>
          <AlertDescription>{apiErr.message}</AlertDescription>
        </Alert>
      ) : null}

      {lgPending ? (
        <p className="text-sm text-muted-foreground">Chargement du logement…</p>
      ) : null}

      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div className="grid gap-2">
          <Label htmlFor="title">Objet du ticket</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Résumé court"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cat">Type d’incident</Label>
          <select
            id="cat"
            className={cn(selectClass)}
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategoryHint)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sim">Simulation pré-requis entretiens</Label>
          <select
            id="sim"
            className={cn(selectClass)}
            value={simulateProofs}
            onChange={(e) => setSimulateProofs(e.target.value)}
          >
            <option value="false">Preuves absentes ou périmées</option>
            <option value="true">Preuves récentes + extérieur conforme</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="d">Date observée incident</Label>
          <Input id="d" readOnly value={incidentDate} />
        </div>
      </div>

      {!gate.blocked && routing ? (
        <Alert>
          <AlertTitle>Ouverture possible</AlertTitle>
          <AlertDescription>
            Routage garantie suggéré : <strong>{routing.labelFr}</strong>
          </AlertDescription>
        </Alert>
      ) : null}

      {!gate.blocked && !routing && logementId && !lgPending && !apiErr ? (
        <Alert>
          <AlertTitle>Résidence</AlertTitle>
          <AlertDescription>
            Impossible de calculer le routage — vérifiez les droits{" "}
            <code className="rounded bg-muted px-1">GET /hlm/residences/:id</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      {gate.blocked ? (
        <Alert variant="destructive">
          <AlertTitle>Ticket bloqué</AlertTitle>
          <AlertDescription>{TICKET_BLOCKED_MAINTENANCE_FR}</AlertDescription>
        </Alert>
      ) : null}

      {submitMsg ? (
        <Alert variant={submitMsg.startsWith("Ticket créé") ? "default" : "destructive"}>
          <AlertTitle>Résultat</AlertTitle>
          <AlertDescription>{submitMsg}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-3">
        <Button
          disabled={gate.blocked || !logementId || createTicket.isPending}
          onClick={async () => {
            setSubmitMsg(null);
            if (!logementId || gate.blocked) return;
            try {
              await createTicket.mutateAsync({
                title,
                category,
                logementId,
              });
              setSubmitMsg("Ticket créé via POST /hlm/tickets.");
            } catch (e: unknown) {
              setSubmitMsg(
                e instanceof Error ? e.message : "Erreur lors de la création.",
              );
            }
          }}
        >
          {createTicket.isPending ? "Envoi…" : "Soumettre au gestionnaire"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/locataire/entretien">Retour aux entretiens</Link>
        </Button>
      </div>
    </div>
  );
}
