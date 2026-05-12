import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const tutos = [
  {
    title: "Entretien VMC",
    desc: "Fréquence trimestrielle, démontage filtres, points de contrôle sécurité.",
  },
  {
    title: "Terrasses & évacuations",
    desc: "Éviter les tickets « infiltration » : nettoyage des émergences et relevés photo.",
  },
];

export default function TutorielsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-semibold">Tutoriels</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {tutos.map((t) => (
          <Card key={t.title}>
            <CardHeader>
              <CardTitle>{t.title}</CardTitle>
              <CardDescription>{t.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Intégrez ici vos vidéos hébergées (Supabase Storage, Vimeo, etc.).
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
