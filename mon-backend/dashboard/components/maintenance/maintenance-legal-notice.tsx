import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MAINTENANCE_CHARGES_NOTICE_FR } from "@/lib/legal/maintenance-copy";

export function MaintenanceLegalNotice() {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Information obligatoire</AlertTitle>
      <AlertDescription>{MAINTENANCE_CHARGES_NOTICE_FR}</AlertDescription>
    </Alert>
  );
}
