import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const rows = [
  {
    date: "2025-03-08",
    type: "VMC",
    status: "validé",
  },
  {
    date: "2025-01-03",
    type: "EXT_TERRASSE",
    status: "refusé",
  },
];

export default function HistoriquePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Historique des preuves</h1>
        <p className="text-muted-foreground">
          Chaque dossier doit conserver la double photographie ainsi que les cases
          cochées (Journal horodaté côté API Supabase dans la version reliée au
          backend).
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Entretien</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.date + r.type}>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.type}</TableCell>
              <TableCell>
                <Badge variant={r.status === "validé" ? "default" : "destructive"}>
                  {r.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
