"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useHlmLogements } from "@/lib/hooks/use-hlm-queries";

export default function LogementsPage() {
  const { data: logements = [], isPending, error } = useHlmLogements();

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <h1 className="text-3xl font-semibold">Logements & équipements</h1>
        <p className="text-muted-foreground">
          Patrimoine synchronisé via{" "}
          <code className="rounded bg-muted px-1">GET /hlm/logements</code>.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur API</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Patrimoine</CardTitle>
          <CardDescription>
            Libellés et rattachement résidence issus du socle HLM NestJS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UUID logement</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Résidence (UUID)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : logements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Aucun logement — créez des unités via l’API bailleur.
                  </TableCell>
                </TableRow>
              ) : (
                logements.map((l) => (
                  <TableRow key={l.reference}>
                    <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                    <TableCell>{l.label}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.residenceReference}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
