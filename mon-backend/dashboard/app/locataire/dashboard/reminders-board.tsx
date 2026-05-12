"use client";

import { Bell } from "lucide-react";
import type { LogementEntretienPlan } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMaintenanceReminders } from "@/hooks/use-maintenance-reminders";
import Link from "next/link";

export function MaintenanceRemindersBoard({
  plans,
  proofHref,
}: {
  plans: LogementEntretienPlan[];
  /** Lien « envoyer des preuves » (ex. premier plan API). */
  proofHref?: string;
}) {
  const reminders = useMaintenanceReminders(plans);
  const overdueCount = reminders.filter((r) => r.severity === "overdue").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Bell className="h-10 w-10 text-primary" />
        <div className="flex-1 space-y-1">
          <CardTitle>Rappels d’entretien</CardTitle>
          <CardDescription>
            Échéances calculées depuis la base équipements (mensuel /
            trimestriel / annuel). Connectez un worker pour notifier par e-mail /
            SMS.
          </CardDescription>
        </div>
        {overdueCount > 0 ? (
          <Badge variant="destructive">{overdueCount} en retard</Badge>
        ) : (
          <Badge variant="outline">Pas de retard</Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-2">
        {reminders.map((r) => (
          <div
            key={r.planId}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="text-sm">
              <div className="font-medium">{r.entretienTypeCode}</div>
              <div className="text-muted-foreground">
                Échéance&nbsp;: {r.dueAt}
              </div>
            </div>
            <Badge variant={r.severity === "overdue" ? "destructive" : "outline"}>
              {r.severity === "due"
                ? "Proche (≤ 7 j.)"
                : r.severity === "overdue"
                  ? "En retard"
                  : "Planifié"}
            </Badge>
          </div>
        ))}
        {proofHref ? (
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={proofHref}
          >
            Envoyer des preuves maintenant →
          </Link>
        ) : (
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href="/locataire/entretien"
          >
            Voir le programme d’entretien →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
