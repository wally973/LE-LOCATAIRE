import type { LogementEntretienPlan, MaintenanceFrequency } from "@/types";

export type ReminderSeverity = "due" | "overdue" | "ok";

export interface MaintenanceReminder {
  planId: string;
  entretienTypeCode: string;
  dueAt: string;
  severity: ReminderSeverity;
}

const MS_DAY = 86400000;

function daysUntil(iso: string): number {
  const d = new Date(iso).setHours(0, 0, 0, 0);
  const t = new Date().setHours(0, 0, 0, 0);
  return Math.round((d - t) / MS_DAY);
}

export function plansToReminders(plans: LogementEntretienPlan[]): MaintenanceReminder[] {
  return plans.map((p) => {
    const due = daysUntil(p.nextDueAt);
    let severity: ReminderSeverity = "ok";
    if (due < 0) severity = "overdue";
    else if (due <= 7) severity = "due";
    return {
      planId: p.id,
      entretienTypeCode: p.entretienTypeCode,
      dueAt: p.nextDueAt,
      severity,
    };
  });
}

export function suggestedFrequencyMonths(f: MaintenanceFrequency): number {
  switch (f) {
    case "mensuel":
      return 1;
    case "trimestriel":
      return 3;
    case "annuel":
      return 12;
    default:
      return 12;
  }
}
