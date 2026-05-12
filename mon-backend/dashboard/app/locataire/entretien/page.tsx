"use client";

import Link from "next/link";
import { MaintenanceLegalNotice } from "@/components/maintenance/maintenance-legal-notice";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  getTenantLogementId,
  useHlmLogementEntretien,
} from "@/lib/hooks/use-hlm-queries";

export default function LocataireEntretienPage() {
  const logementId = getTenantLogementId();
  const { data: plans = [], isPending, error } = useHlmLogementEntretien(logementId);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Entretiens obligatoires</h1>
        <p className="mt-2 text-muted-foreground">
          Données synchronisées depuis{" "}
          <code className="rounded bg-muted px-1">GET /hlm/entretien/logement/:id</code>{" "}
          pour votre logement configuré.
        </p>
      </div>

      {!process.env.NEXT_PUBLIC_API_URL ? (
        <Alert variant="destructive">
          <AlertTitle>API</AlertTitle>
          <AlertDescription>
            Configurez <code className="rounded bg-muted px-1">NEXT_PUBLIC_API_URL</code>.
          </AlertDescription>
        </Alert>
      ) : null}
      {!logementId ? (
        <Alert>
          <AlertTitle>Logement</AlertTitle>
          <AlertDescription>
            Définissez{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_HLM_LOGEMENT_ID</code>.
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <MaintenanceLegalNotice />
      <Card>
        <CardHeader>
          <CardTitle>
            Plan d’entretien du logement {logementId ? logementId.slice(0, 8) + "…" : "—"}
          </CardTitle>
          <CardDescription>
            Module 2 &amp; 3 — lignes actives issues du socle Prisma HLM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune ligne de plan — demandez une initialisation entretien côté bailleur
              ou vérifiez que des types catalogue sont rattachés au logement.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type (code)</TableHead>
                  <TableHead>Prochaine échéance</TableHead>
                  <TableHead>Privatif extérieur</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.entretienTypeCode}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.nextDueAt}</Badge>
                    </TableCell>
                    <TableCell>
                      {/^EXT_|EXTERIEUR|SOL_/i.test(row.entretienTypeCode) ? (
                        <Badge variant="warning">Contexte extérieur</Badge>
                      ) : (
                        <Badge variant="secondary">Technique</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/locataire/entretien/preuves/${encodeURIComponent(row.id)}`}>
                          Preuves
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
