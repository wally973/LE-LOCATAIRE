"use client";

import { useMemo, useState } from "react";
import type { Residence } from "@/types";
import { computeWarrantyDates } from "@/lib/warranty/compute-dates";
import { suggestTicketRouting } from "@/lib/routing/ticket-route";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NouvelleResidencePage() {
  const [name, setName] = useState("Résidence Pilote");
  const [delivery, setDelivery] = useState("2024-01-10");
  const [constructionYear, setConstructionYear] = useState("2023");
  const [neuve, setNeuve] = useState(true);
  const [gpaInterne, setGpaInterne] = useState(true);

  const faux: Residence = useMemo(
    () => ({
      id: "temp",
      name,
      bailleurId: "bal-1",
      constructionYear: parseInt(constructionYear, 10) || undefined,
      deliveryDate: delivery,
      residenceNeuve: neuve,
      hasInternalGPAService: gpaInterne,
    }),
    [name, delivery, constructionYear, neuve, gpaInterne],
  );

  const warranties = computeWarrantyDates(faux);
  const routeSample = suggestTicketRouting(faux, new Date().toISOString());

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Module 1 · Résidences & garanties</h1>
        <p className="text-muted-foreground">
          Chaque ajout doit stocker ces champs côté Prisma puis recalculer les
          échéances côté service ou SQL view.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Fiche résidence</CardTitle>
          <CardDescription>
            Déclarez l’état juridique (neuve) et votre capacité de service GPA avant
            d’attribuer automatiquement les tickets entrants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="n">Nom de la résidence</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="y">Année de construction</Label>
            <Input
              id="y"
              type="number"
              value={constructionYear}
              onChange={(e) => setConstructionYear(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deliv">Date de livraison</Label>
            <Input
              id="deliv"
              type="date"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={neuve}
              id="neuve"
              onCheckedChange={(v) => setNeuve(!!v)}
            />
            <Label htmlFor="neuve">Résidence neuve</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={gpaInterne}
              id="gpa"
              onCheckedChange={(v) => setGpaInterne(!!v)}
            />
            <Label htmlFor="gpa">
              Disposer d’un service GPA interne sur cette résidence
            </Label>
          </div>
          <Button type="button">Synchroniser avec l’ERP (stub)</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calcul garanties</CardTitle>
          <CardDescription>
            gpaEndDate = livraison + 1 an · biennale +2 ans · décennale +10 ans (règle
            simplifiée, à contractualiser lors du déploiement).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm font-mono">
          <span>GPA jusqu’au : {warranties.gpaEndDate}</span>
          <span>Biennale jusqu’au : {warranties.biennaleEndDate}</span>
          <span>Décennale jusqu’au : {warranties.decennaleEndDate}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routage ticket (instantané)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {routeSample.labelFr}
        </CardContent>
      </Card>
    </div>
  );
}
