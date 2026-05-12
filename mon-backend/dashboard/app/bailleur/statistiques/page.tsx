import { TicketStatsChart } from "@/components/charts/ticket-stats-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function StatistiquesPage() {
  const data = [
    { name: "Résidences neuves", v: 5 },
    { name: "GPA encore couverte", v: 2 },
    { name: "Entretiens retard", v: 11 },
    { name: "Litiges évité", v: 19 },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Statistiques</h1>
        <p className="text-muted-foreground">
          Pilotage KPI coûts de maintenance vs tickets évitées (valeurs exemple).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Analyse tendancielle</CardTitle>
          <CardDescription>Connectez vos vues métier Supabase ici.</CardDescription>
        </CardHeader>
        <CardContent>
          <TicketStatsChart data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
