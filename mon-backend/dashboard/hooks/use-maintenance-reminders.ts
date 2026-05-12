"use client";

import { useMemo } from "react";
import type { LogementEntretienPlan } from "@/types";
import { plansToReminders } from "@/lib/reminders/reminders";

/** Prépare badges / toasts côté UI (ici : dérivé synchrone ; branchez sur push plus tard). */
export function useMaintenanceReminders(plans: LogementEntretienPlan[]) {
  return useMemo(() => plansToReminders(plans), [plans]);
}
