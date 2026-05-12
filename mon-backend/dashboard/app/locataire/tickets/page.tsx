"use client";

import Link from "next/link";
import { TICKET_BLOCKED_MAINTENANCE_FR } from "@/lib/legal/maintenance-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useHlmTickets } from "@/lib/hooks/use-hlm-queries";

export default function TenantTicketsPage() {
  const { data: tickets = [], isPending, error } = useHlmTickets();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Tickets</h1>
          <p className="text-muted-foreground">
            Liste issue de{" "}
            <code className="rounded bg-muted px-1">GET /hlm/tickets</code> — JWT requis.
          </p>
        </div>
        <Button asChild>
          <Link href="/locataire/tickets/nouveau">Création guidée</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur API</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm">
        <strong>Message type :</strong> {TICKET_BLOCKED_MAINTENANCE_FR}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sujet</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending ? (
            <TableRow>
              <TableCell colSpan={2} className="text-muted-foreground">
                Chargement…
              </TableCell>
            </TableRow>
          ) : tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-muted-foreground">
                Aucun ticket.
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.title}</TableCell>
                <TableCell>
                  <Badge
                    variant={t.status === "BLOQUE_ENTRETIEN" ? "destructive" : "outline"}
                  >
                    {t.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
