"use client";

import { aiMaintenanceEndpoints } from "@/lib/api/ai-endpoints";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useHlmTickets } from "@/lib/hooks/use-hlm-queries";

export default function BailleurTicketsPage() {
  const { data: tickets = [], isPending, error } = useHlmTickets();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Tickets régulés</h1>
        <p className="text-muted-foreground">
          Liste live :{" "}
          <code className="rounded bg-muted px-1">GET /hlm/tickets</code>
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur API</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Alert>
        <AlertTitle>IA-ready</AlertTitle>
        <AlertDescription>
          POST enrichi conseillé :{" "}
          <code>{aiMaintenanceEndpoints.routeTicketSuggestion}</code>
        </AlertDescription>
      </Alert>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sujet</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Blocage technique</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                Chargement…
              </TableCell>
            </TableRow>
          ) : tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                Aucun ticket.
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{t.status}</Badge>
                </TableCell>
                <TableCell>{t.blockedReason ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
