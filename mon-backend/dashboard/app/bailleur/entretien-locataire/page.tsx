import { ENTRETIEN_TYPES } from "@/lib/data/entretien-catalog";
import { MAINTENANCE_CHARGES_NOTICE_FR } from "@/lib/legal/maintenance-copy";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function EntretienLocatairePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Pilotage obligations locatives</h1>
        <p className="text-muted-foreground">
          Visualise ce que les locataires doivent prouver pour débloquer certains
          tickets liés nuisibles ou étanchéité extérieurs.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rappels obligatoires</CardTitle>
          <CardDescription>{MAINTENANCE_CHARGES_NOTICE_FR}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ENTRETIEN_TYPES.slice(0, 6).map((e) => (
            <Badge key={e.code} variant="outline">
              {e.labelFr}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
