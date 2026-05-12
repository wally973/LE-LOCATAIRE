"use client";

import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Deux photos obligatoires. En production : upload S3/Supabase via API signée.
 * Ici : champ URL pour démonstration / intégration tests.
 */
export function ProofPhotoUpload({
  onUrlsChange,
}: {
  onUrlsChange: (p: { cleaning: string; final: string }) => void;
}) {
  const id = useId();
  const [cleaning, setCleaning] = useState("");
  const [finalState, setFinalState] = useState("");

  const push = (c: string, f: string) => {
    onUrlsChange({ cleaning: c, final: f });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preuves photographiques (2 obligatoires)</CardTitle>
        <CardDescription>
          Photo 1 : preuve du nettoyage / opération. Photo 2 : état final.
          Remplacez par un vrai uploader connecté à votre stockage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-c`}>URL photo nettoyage</Label>
          <Input
            id={`${id}-c`}
            placeholder="https://..."
            value={cleaning}
            onChange={(e) => {
              setCleaning(e.target.value);
              push(e.target.value, finalState);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-f`}>URL photo état final</Label>
          <Input
            id={`${id}-f`}
            placeholder="https://..."
            value={finalState}
            onChange={(e) => {
              setFinalState(e.target.value);
              push(cleaning, e.target.value);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
