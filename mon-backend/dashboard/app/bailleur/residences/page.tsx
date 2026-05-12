"use client";

import Link from "next/link";
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
import { useHlmResidences } from "@/lib/hooks/use-hlm-queries";

export default function ResidencesListePage() {
  const { data: residences = [], isPending, error } = useHlmResidences();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Résidences</h1>
          <p className="text-muted-foreground">
            Source : <code className="rounded bg-muted px-1">GET /hlm/residences</code>
          </p>
        </div>
        <Button asChild>
          <Link href="/bailleur/residences/nouvelle">Nouvelle résidence</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur API</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Livraison</TableHead>
            <TableHead>Neuve</TableHead>
            <TableHead>GPA interne</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Chargement…
              </TableCell>
            </TableRow>
          ) : residences.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Aucune résidence — créez-en une via le backend ou le formulaire.
              </TableCell>
            </TableRow>
          ) : (
            residences.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.deliveryDate}</TableCell>
                <TableCell>{r.residenceNeuve ? "oui" : "non"}</TableCell>
                <TableCell>{r.hasInternalGPAService ? "oui" : "non"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
